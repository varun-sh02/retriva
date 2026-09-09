import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchChunks } from "@/lib/qdrant/search";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentName: string;
  contentType: string;
  content: string;
  pageNumber: number | null;
  startTimestamp: number | null;
  endTimestamp: number | null;
  sectionPath: string | null;
  score: number;
};

export type RetrieveChunksParams = {
  workspaceId: string;
  knowledgeBaseId: string;
  queryVector: number[];
  topK: number;
  scoreThreshold: number;
  maxChunksPerDocument: number;
  finalContextChunks: number;
};

/**
 * Vector search (Qdrant) → per-document cap → hydration from Postgres →
 * dedup → final slice. Chunk text is read from Postgres, never the Qdrant
 * payload (ADR-006) — Qdrant returns identifiers and scores only.
 */
export async function retrieveChunks(
  supabase: SupabaseClient,
  params: RetrieveChunksParams,
): Promise<RetrievedChunk[]> {
  const points = await searchChunks({
    workspaceId: params.workspaceId,
    knowledgeBaseId: params.knowledgeBaseId,
    vector: params.queryVector,
    limit: params.topK,
    scoreThreshold: params.scoreThreshold,
  });

  // Cap per document across all candidates first — but do NOT stop at
  // finalContextChunks yet. An image produces two Qdrant points (text +
  // native image vector_kind, ADR-005) sharing identical content; both can
  // legitimately rank in the top candidates. Deduping by content has to
  // happen after hydration, so the final slice below is taken from an
  // already-deduplicated list rather than truncating before dedup can run.
  const perDocumentCount = new Map<string, number>();
  const capped: typeof points = [];

  for (const point of points) {
    const count = perDocumentCount.get(point.documentId) ?? 0;
    if (count >= params.maxChunksPerDocument) continue;
    perDocumentCount.set(point.documentId, count + 1);
    capped.push(point);
  }

  if (capped.length === 0) {
    return [];
  }

  const { data: chunkRows, error: chunksError } = await supabase
    .from("chunks")
    .select("id, document_id, content, content_type, page_number, start_timestamp, end_timestamp, section_path")
    .in(
      "id",
      capped.map((p) => p.chunkId),
    );
  if (chunksError) throw chunksError;

  const documentIds = [...new Set(capped.map((p) => p.documentId))];
  const { data: documentRows, error: documentsError } = await supabase
    .from("documents")
    .select("id, name")
    .in("id", documentIds);
  if (documentsError) throw documentsError;

  const chunkById = new Map((chunkRows ?? []).map((row) => [row.id, row]));
  const documentNameById = new Map((documentRows ?? []).map((row) => [row.id, row.name as string]));

  const hydrated: RetrievedChunk[] = [];
  const seenContentByDocument = new Set<string>();

  for (const point of capped) {
    const chunk = chunkById.get(point.chunkId);
    // A point can exist in Qdrant with no corresponding Postgres row only
    // in a race with an in-flight delete — skip rather than surface a gap.
    if (!chunk) continue;

    // Dedup: an image's text and image vector_kind rows share identical
    // content (docs/multimodal-ingestion.md §4) — whichever vector matched
    // first (already highest-scored, since `points` is score-sorted) wins
    // the context slot; the other is redundant, not new evidence.
    const dedupeKey = `${point.documentId}::${chunk.content}`;
    if (seenContentByDocument.has(dedupeKey)) continue;
    seenContentByDocument.add(dedupeKey);

    hydrated.push({
      chunkId: point.chunkId,
      documentId: point.documentId,
      documentName: documentNameById.get(point.documentId) ?? "Unknown document",
      contentType: chunk.content_type,
      content: chunk.content,
      pageNumber: chunk.page_number,
      startTimestamp: chunk.start_timestamp,
      endTimestamp: chunk.end_timestamp,
      sectionPath: chunk.section_path,
      score: point.score,
    });

    if (hydrated.length >= params.finalContextChunks) break;
  }

  return hydrated;
}
