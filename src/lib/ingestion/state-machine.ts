import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIndexText, embedImage, embedText } from "@/lib/gemini/embeddings";
import { upsertChunks } from "@/lib/qdrant/upsert";
import { chunkPdfPages, chunkText, DEFAULT_CHUNKER_CONFIG } from "./chunker";
import { extractDocx } from "./docx";
import { analyzeImage, buildImageTextRecord, type ImageAnalysis } from "./image";
import { transcodeToPngIfNeeded } from "./image-transcode";
import { extractMarkdown } from "./markdown";
import { ensureGeminiFile, extractPdfPageBatch, getPdfPageCount, type ExtractedPage } from "./pdf";
import { extractText } from "./text";
import { segmentVideo } from "./video";
import { getVideoDurationSeconds } from "./video-duration";
import { validateSegments, type ValidatedSegment } from "./video-validate";

const PDF_PAGES_PER_BATCH = 10;
const EMBEDDING_BATCH_SIZE = 10;
const LOCK_STALE_MS = 6 * 60 * 1000;
const EMBEDDING_MODEL = "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 1536;

const SUSPICIOUS_CONTENT_PATTERN =
  /ignore (all |every |the )?(previous|prior|above) instructions?|disregard (all |every )?(previous|prior) instructions?|you are now |system prompt|reveal (your |the )?(system )?prompt/i;

/** Flags, never blocks (docs/security.md T3) — see the call site for why. */
function isSuspiciousContent(content: string): boolean {
  return SUSPICIOUS_CONTENT_PATTERN.test(content);
}

export type ProcessOutcome = {
  status: string;
  stage: string | null;
  progress: { current: number; total: number; unit: string };
  done: boolean;
  error?: string;
};

type DocumentRow = {
  id: string;
  knowledge_base_id: string;
  workspace_id: string;
  name: string;
  content_type: string;
  mime_type: string;
  storage_path: string;
  status: string;
  stage: string | null;
  stage_cursor: Record<string, unknown>;
  gemini_file_uri: string | null;
  gemini_file_expires_at: string | null;
};

/**
 * Claims the processing lock and advances the document by exactly one
 * stage (or one batch within EXTRACTING/EMBEDDING). A stale lock (>6 min)
 * is reclaimable — see docs/technical-decisions.md ADR-007.
 */
export async function advanceProcessing(
  supabase: SupabaseClient,
  workspaceId: string,
  documentId: string,
): Promise<ProcessOutcome> {
  const staleThreshold = new Date(Date.now() - LOCK_STALE_MS).toISOString();

  const { data: claimed, error: claimError } = await supabase
    .from("documents")
    .update({ processing_lock: new Date().toISOString() })
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .eq("status", "PROCESSING")
    .or(`processing_lock.is.null,processing_lock.lt.${staleThreshold}`)
    .select(
      "id, knowledge_base_id, workspace_id, name, content_type, mime_type, storage_path, status, stage, stage_cursor, gemini_file_uri, gemini_file_expires_at",
    )
    .maybeSingle();

  if (claimError) throw claimError;

  if (!claimed) {
    const { data: current, error: currentError } = await supabase
      .from("documents")
      .select("status, stage")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .single();

    if (currentError) throw currentError;

    if (current.status === "READY" || current.status === "FAILED") {
      return {
        status: current.status,
        stage: current.stage,
        progress: { current: 1, total: 1, unit: "chunks" },
        done: true,
      };
    }

    const lockError = new Error("ALREADY_PROCESSING");
    lockError.name = "AlreadyProcessingError";
    throw lockError;
  }

  const document = claimed as DocumentRow;

  try {
    const outcome = await runStage(supabase, document);
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("documents")
      .update({ status: "FAILED", error_message: message, processing_lock: null })
      .eq("id", documentId);

    await supabase.from("processing_runs").insert({
      document_id: documentId,
      workspace_id: workspaceId,
      stage: document.stage ?? "PENDING",
      outcome: "failure",
      error: message,
    });

    return {
      status: "FAILED",
      stage: document.stage,
      progress: { current: 0, total: 1, unit: "chunks" },
      done: true,
      error: message,
    };
  }
}

async function runStage(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  const stage = document.stage ?? "PENDING";

  switch (stage) {
    case "PENDING":
    case "EXTRACTING":
      return runExtracting(supabase, document);
    case "CHUNKING":
      return runChunking(supabase, document);
    case "EMBEDDING":
      return runEmbedding(supabase, document);
    case "INDEXING":
      return runIndexing(supabase, document);
    default:
      throw new Error(`Unknown processing stage "${stage}"`);
  }
}

async function downloadOriginal(supabase: SupabaseClient, document: DocumentRow): Promise<Buffer> {
  const { data, error } = await supabase.storage.from("documents").download(document.storage_path);
  if (error || !data) {
    throw new Error(`Could not read the original file from storage: ${error?.message ?? "unknown error"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

async function runExtracting(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  if (document.content_type === "pdf") {
    return runExtractingPdf(supabase, document);
  }
  if (document.content_type === "image") {
    return runExtractingImage(supabase, document);
  }
  if (document.content_type === "video") {
    return runExtractingVideo(supabase, document);
  }

  const buffer = await downloadOriginal(supabase, document);
  let text: string;

  if (document.content_type === "docx") {
    text = (await extractDocx(buffer)).markdown;
  } else if (document.content_type === "markdown") {
    text = extractMarkdown(buffer).text;
  } else {
    text = extractText(buffer).text;
  }

  await supabase
    .from("documents")
    .update({
      metadata: { extractedText: text },
      stage: "CHUNKING",
      stage_cursor: {},
      processing_lock: null,
    })
    .eq("id", document.id);

  await logRun(supabase, document, "EXTRACTING", "success");

  return {
    status: "PROCESSING",
    stage: "CHUNKING",
    progress: { current: 1, total: 1, unit: "pages" },
    done: false,
  };
}

async function runExtractingPdf(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  const cursor = document.stage_cursor as {
    extractedThroughPage?: number;
    pages?: ExtractedPage[];
  };
  const alreadyExtractedThrough = cursor.extractedThroughPage ?? 0;
  const accumulatedPages = cursor.pages ?? [];

  const buffer = await downloadOriginal(supabase, document);
  const totalPages = await getPdfPageCount(buffer);

  const geminiFile = await ensureGeminiFile(buffer, "application/pdf", {
    uri: document.gemini_file_uri ?? "",
    expiresAt: document.gemini_file_expires_at,
  });

  const batchStart = alreadyExtractedThrough + 1;
  const batchEnd = Math.min(batchStart + PDF_PAGES_PER_BATCH - 1, totalPages);

  const newPages = await extractPdfPageBatch(geminiFile.uri, "application/pdf", batchStart, batchEnd);
  const allPages = [...accumulatedPages, ...newPages];
  const done = batchEnd >= totalPages;

  await supabase
    .from("documents")
    .update({
      gemini_file_uri: geminiFile.uri,
      gemini_file_expires_at: geminiFile.expiresAt?.toISOString() ?? null,
      stage: done ? "CHUNKING" : "EXTRACTING",
      stage_cursor: done ? {} : { extractedThroughPage: batchEnd, pages: allPages },
      metadata: done ? { extractedPages: allPages } : {},
      processing_lock: null,
    })
    .eq("id", document.id);

  await logRun(supabase, document, "EXTRACTING", "success");

  return {
    status: "PROCESSING",
    stage: done ? "CHUNKING" : "EXTRACTING",
    progress: { current: batchEnd, total: totalPages, unit: "pages" },
    done: false,
  };
}

async function runExtractingImage(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  const buffer = await downloadOriginal(supabase, document);
  const { buffer: transcoded, mimeType } = await transcodeToPngIfNeeded(buffer, document.mime_type);
  const analysis = await analyzeImage(transcoded, mimeType);
  const textRecord = buildImageTextRecord(analysis, document.name);

  await supabase
    .from("documents")
    .update({
      metadata: { imageAnalysis: analysis, imageTextRecord: textRecord },
      stage: "CHUNKING",
      stage_cursor: {},
      processing_lock: null,
    })
    .eq("id", document.id);

  await logRun(supabase, document, "EXTRACTING", "success");

  return {
    status: "PROCESSING",
    stage: "CHUNKING",
    progress: { current: 1, total: 1, unit: "pages" },
    done: false,
  };
}

async function runExtractingVideo(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  const buffer = await downloadOriginal(supabase, document);
  const durationSeconds = getVideoDurationSeconds(buffer);

  const geminiFile = await ensureGeminiFile(buffer, document.mime_type, {
    uri: document.gemini_file_uri ?? "",
    expiresAt: document.gemini_file_expires_at,
  });

  const rawSegments = await segmentVideo(geminiFile.uri, document.mime_type);
  const { valid, droppedCount, failed } = validateSegments(rawSegments, durationSeconds);

  if (failed) {
    throw new Error(
      `Video segmentation produced too many invalid segments (${droppedCount}/${rawSegments.length} ` +
        `dropped) — the document is failed rather than partially indexed with unreliable timestamps.`,
    );
  }

  await supabase
    .from("documents")
    .update({
      gemini_file_uri: geminiFile.uri,
      gemini_file_expires_at: geminiFile.expiresAt?.toISOString() ?? null,
      metadata: { videoSegments: valid, durationSeconds, droppedSegmentCount: droppedCount },
      stage: "CHUNKING",
      stage_cursor: {},
      processing_lock: null,
    })
    .eq("id", document.id);

  await logRun(supabase, document, "EXTRACTING", "success");

  return {
    status: "PROCESSING",
    stage: "CHUNKING",
    progress: { current: valid.length, total: rawSegments.length, unit: "segments" },
    done: false,
  };
}

async function runChunking(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  const { data: docRow, error: docError } = await supabase
    .from("documents")
    .select("metadata")
    .eq("id", document.id)
    .single();
  if (docError) throw docError;

  const metadata = docRow.metadata as {
    extractedText?: string;
    extractedPages?: ExtractedPage[];
    imageTextRecord?: string;
    imageAnalysis?: ImageAnalysis;
    videoSegments?: ValidatedSegment[];
  };

  type ChunkInsert = {
    document_id: string;
    knowledge_base_id: string;
    workspace_id: string;
    chunk_index: number;
    content: string;
    content_type: string;
    section_path: string | null;
    page_number: number | null;
    start_timestamp?: number | null;
    end_timestamp?: number | null;
    vector_kind: "text" | "image";
    metadata?: Record<string, unknown>;
  };

  let rows: ChunkInsert[];

  if (document.content_type === "video") {
    // One chunk per validated segment (transcript-first — no native video
    // embedding in the MVP, ADR-015). visualContext is folded into the
    // embedded/quoted content only when it actually carries meaning.
    const segments = metadata.videoSegments ?? [];
    rows = segments.map((segment, index) => ({
      document_id: document.id,
      knowledge_base_id: document.knowledge_base_id,
      workspace_id: document.workspace_id,
      chunk_index: index,
      content: segment.visualContext
        ? `${segment.transcript}\n\n[On screen: ${segment.visualContext}]`
        : segment.transcript,
      content_type: document.content_type,
      section_path: segment.title,
      page_number: null,
      start_timestamp: segment.startSeconds,
      end_timestamp: segment.endSeconds,
      vector_kind: "text",
    }));
  } else if (document.content_type === "image") {
    // Two rows sharing chunk_index 0, distinguished by vector_kind — the
    // unique index is on (document_id, chunk_index, vector_kind), so this is
    // valid. Both carry the same text content: a citation should quote the
    // same description regardless of which vector kind matched the query
    // (docs/multimodal-ingestion.md §4).
    const content = metadata.imageTextRecord ?? "";
    rows = [
      {
        document_id: document.id,
        knowledge_base_id: document.knowledge_base_id,
        workspace_id: document.workspace_id,
        chunk_index: 0,
        content,
        content_type: document.content_type,
        section_path: null,
        page_number: null,
        vector_kind: "text",
      },
      {
        document_id: document.id,
        knowledge_base_id: document.knowledge_base_id,
        workspace_id: document.workspace_id,
        chunk_index: 0,
        content,
        content_type: document.content_type,
        section_path: null,
        page_number: null,
        vector_kind: "image",
      },
    ];
  } else if (document.content_type === "pdf") {
    const pages = metadata.extractedPages ?? [];
    const pdfChunks = chunkPdfPages(pages, DEFAULT_CHUNKER_CONFIG);
    rows = pdfChunks.map((chunk, index) => ({
      document_id: document.id,
      knowledge_base_id: document.knowledge_base_id,
      workspace_id: document.workspace_id,
      chunk_index: index,
      content: chunk.content,
      content_type: document.content_type,
      section_path: chunk.sectionPath,
      page_number: chunk.pageNumber,
      vector_kind: "text",
    }));
  } else {
    const textChunks = chunkText(metadata.extractedText ?? "", DEFAULT_CHUNKER_CONFIG);
    rows = textChunks.map((chunk, index) => ({
      document_id: document.id,
      knowledge_base_id: document.knowledge_base_id,
      workspace_id: document.workspace_id,
      chunk_index: index,
      content: chunk.content,
      content_type: document.content_type,
      section_path: chunk.sectionPath,
      page_number: null,
      vector_kind: "text",
    }));
  }

  // Flags, never blocks (docs/security.md T3) — surfaced only in
  // retrieval_logs/evals for measurement, not enforced against the user's
  // own uploaded content. A document *about* prompt injection would
  // otherwise be wrongly treated as an attack.
  const flaggedRows = rows.map((row) => ({
    ...row,
    metadata: { ...row.metadata, ...(isSuspiciousContent(row.content) ? { suspicious: true } : {}) },
  }));

  // Delete-then-insert makes CHUNKING idempotent under retry (docs/data-model.md §3).
  const { error: deleteError } = await supabase.from("chunks").delete().eq("document_id", document.id);
  if (deleteError) throw deleteError;

  if (flaggedRows.length > 0) {
    const { error: insertError } = await supabase.from("chunks").insert(flaggedRows);
    if (insertError) throw insertError;
  }

  await supabase
    .from("documents")
    .update({ stage: "EMBEDDING", stage_cursor: { embeddedThrough: 0 }, processing_lock: null })
    .eq("id", document.id);

  await logRun(supabase, document, "CHUNKING", "success");

  return {
    status: "PROCESSING",
    stage: "EMBEDDING",
    progress: { current: rows.length, total: rows.length, unit: "chunks" },
    done: false,
  };
}

async function runEmbedding(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  const cursor = document.stage_cursor as { embeddedThrough?: number };
  const embeddedThrough = cursor.embeddedThrough ?? 0;

  const { data: chunkRows, error: chunksError } = await supabase
    .from("chunks")
    .select("id, content, section_path, vector_kind, metadata")
    .eq("document_id", document.id)
    .is("embedding_model", null)
    .order("chunk_index", { ascending: true })
    .range(0, EMBEDDING_BATCH_SIZE - 1);

  if (chunksError) throw chunksError;

  if (!chunkRows || chunkRows.length === 0) {
    await supabase
      .from("documents")
      .update({ stage: "INDEXING", processing_lock: null })
      .eq("id", document.id);

    await logRun(supabase, document, "EMBEDDING", "success");

    return {
      status: "PROCESSING",
      stage: "INDEXING",
      progress: { current: embeddedThrough, total: embeddedThrough, unit: "chunks" },
      done: false,
    };
  }

  // Loaded lazily, at most once per batch: only a chunk with
  // vector_kind: "image" needs the raw (transcoded) image bytes.
  let transcodedImage: { buffer: Buffer; mimeType: string } | null = null;

  for (const chunk of chunkRows) {
    let vector: number[];

    if (chunk.vector_kind === "image") {
      if (!transcodedImage) {
        const buffer = await downloadOriginal(supabase, document);
        transcodedImage = await transcodeToPngIfNeeded(buffer, document.mime_type);
      }
      vector = await embedImage(transcodedImage.buffer, transcodedImage.mimeType);
    } else {
      const indexText = buildIndexText({
        documentName: document.name,
        sectionPath: chunk.section_path,
        content: chunk.content,
      });
      vector = await embedText(indexText);
    }

    // Merge, never overwrite: chunks.metadata also carries the
    // suspicious-content flag set at CHUNKING (and, for images, the vision
    // analysis) — this is the transient scratch slot for the embedding
    // vector between the EMBEDDING and INDEXING stage-calls, not the whole
    // column's owner.
    const existingMetadata = (chunk.metadata as Record<string, unknown>) ?? {};
    const { error: updateError } = await supabase
      .from("chunks")
      .update({
        embedding_model: EMBEDDING_MODEL,
        embedding_dim: EMBEDDING_DIMENSIONS,
        metadata: { ...existingMetadata, vector },
      })
      .eq("id", chunk.id);
    if (updateError) throw updateError;
  }

  const newEmbeddedThrough = embeddedThrough + chunkRows.length;

  await supabase
    .from("documents")
    .update({ stage_cursor: { embeddedThrough: newEmbeddedThrough }, processing_lock: null })
    .eq("id", document.id);

  return {
    status: "PROCESSING",
    stage: "EMBEDDING",
    progress: { current: newEmbeddedThrough, total: newEmbeddedThrough, unit: "chunks" },
    done: false,
  };
}

async function runIndexing(
  supabase: SupabaseClient,
  document: DocumentRow,
): Promise<ProcessOutcome> {
  const { data: chunkRows, error } = await supabase
    .from("chunks")
    .select("id, content_type, section_path, page_number, start_timestamp, end_timestamp, vector_kind, metadata")
    .eq("document_id", document.id)
    .is("qdrant_point_id", null);

  if (error) throw error;

  const remainingMetadataByChunkId = new Map<string, Record<string, unknown>>();

  const points = (chunkRows ?? [])
    .map((chunk) => {
      const { vector, ...remaining } = (chunk.metadata as { vector?: number[] } & Record<string, unknown>) ?? {};
      if (!vector) return null;

      remainingMetadataByChunkId.set(chunk.id as string, remaining);

      return {
        chunkId: chunk.id as string,
        vector,
        workspaceId: document.workspace_id,
        knowledgeBaseId: document.knowledge_base_id,
        documentId: document.id,
        contentType: chunk.content_type as string,
        vectorKind: chunk.vector_kind as "text" | "image",
        documentName: document.name,
        pageNumber: chunk.page_number as number | null,
        startTimestamp: chunk.start_timestamp as number | null,
        endTimestamp: chunk.end_timestamp as number | null,
        sectionPath: chunk.section_path as string | null,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  await upsertChunks(points);

  for (const point of points) {
    // Clears the transient `vector` scratch field but preserves everything
    // else (e.g. the suspicious-content flag, image vision analysis) —
    // see the matching comment in runEmbedding.
    await supabase
      .from("chunks")
      .update({
        qdrant_point_id: point.chunkId,
        metadata: remainingMetadataByChunkId.get(point.chunkId) ?? {},
      })
      .eq("id", point.chunkId);
  }

  const { count } = await supabase
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", document.id);

  await supabase
    .from("documents")
    .update({
      stage: "DONE",
      status: "READY",
      chunk_count: count ?? points.length,
      processing_lock: null,
    })
    .eq("id", document.id);

  await logRun(supabase, document, "INDEXING", "success");

  return {
    status: "READY",
    stage: "DONE",
    progress: { current: count ?? points.length, total: count ?? points.length, unit: "chunks" },
    done: true,
  };
}

async function logRun(
  supabase: SupabaseClient,
  document: DocumentRow,
  stage: string,
  outcome: "success" | "failure",
) {
  await supabase.from("processing_runs").insert({
    document_id: document.id,
    workspace_id: document.workspace_id,
    stage,
    outcome,
  });
}
