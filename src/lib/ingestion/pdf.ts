import "server-only";
import { getDocumentProxy } from "unpdf";
import { getGeminiClient, withRetry } from "@/lib/gemini/client";
import { type UploadedGeminiFile, uploadToGeminiFiles } from "@/lib/gemini/files";
import { serverEnv } from "@/lib/config/server-env";

export type ExtractedPage = {
  pageNumber: number;
  markdown: string;
  sectionPath: string | null;
  hasVisuals: boolean;
};

const PAGE_BATCH_SCHEMA = {
  type: "object",
  properties: {
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pageNumber: { type: "integer" },
          markdown: { type: "string" },
          sectionPath: { type: "string" },
          hasVisuals: { type: "boolean" },
        },
        required: ["pageNumber", "markdown"],
      },
    },
  },
  required: ["pages"],
};

type RawPage = {
  pageNumber?: unknown;
  markdown?: unknown;
  sectionPath?: unknown;
  hasVisuals?: unknown;
};

/** unpdf reads the container locally — no Gemini call needed just for this. */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  return doc.numPages;
}

/**
 * Uploads a PDF to the Gemini Files API only if there's no still-valid
 * existing upload to reuse — the state machine persists `gemini_file_uri`/
 * `gemini_file_expires_at` (docs/data-model.md §2) precisely so a resumed
 * `/process` call doesn't re-upload the whole file.
 */
export async function ensureGeminiFile(
  buffer: Buffer,
  mimeType: string,
  existing?: { uri: string; expiresAt: string | null } | null,
): Promise<UploadedGeminiFile> {
  if (existing?.expiresAt && new Date(existing.expiresAt).getTime() > Date.now()) {
    return { uri: existing.uri, name: existing.uri, expiresAt: new Date(existing.expiresAt) };
  }

  return uploadToGeminiFiles(buffer, mimeType);
}

/**
 * Extracts one batch of pages [startPage, endPage] using Gemini's native
 * PDF vision (reads diagrams/tables/charts, not just a text layer —
 * docs/multimodal-ingestion.md §1). The model's own page numbers are a hint
 * only: anything outside [startPage, endPage] is replaced with the correct
 * positional page number rather than trusted (citations must never carry a
 * hallucinated page number).
 */
export async function extractPdfPageBatch(
  fileUri: string,
  mimeType: string,
  startPage: number,
  endPage: number,
): Promise<ExtractedPage[]> {
  const ai = getGeminiClient();

  const prompt = [
    `Transcribe pages ${startPage} through ${endPage} of this PDF faithfully, one entry per page.`,
    "For each page: transcribe all text exactly. Describe diagrams, charts, and images in prose where they appear.",
    "Render tables as markdown tables. Do not summarize or skip content.",
    "Set sectionPath to the heading hierarchy the page falls under (e.g. 'Architecture > Persistence'), if any.",
    "Set hasVisuals to true if the page contains a diagram, chart, or image.",
    `Set pageNumber to the true printed page number, where the first page of the document is 1 (this batch covers pages ${startPage}-${endPage}).`,
  ].join(" ");

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: serverEnv.GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ fileData: { fileUri, mimeType } }, { text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: PAGE_BATCH_SCHEMA,
      },
    }),
  );

  const parsed: unknown = JSON.parse(response.text ?? "{}");
  const rawPages: RawPage[] = Array.isArray((parsed as { pages?: unknown })?.pages)
    ? ((parsed as { pages: RawPage[] }).pages)
    : [];

  const validPageNumbers = new Set<number>();
  for (let n = startPage; n <= endPage; n++) validPageNumbers.add(n);

  const byPosition = new Map<number, RawPage>();
  rawPages.forEach((page, index) => {
    const positional = startPage + index;
    byPosition.set(positional, page);
  });

  const pages: ExtractedPage[] = [];
  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
    const raw = byPosition.get(pageNumber);
    if (!raw) continue;

    const claimedPageNumber = typeof raw.pageNumber === "number" ? raw.pageNumber : undefined;
    // Cross-check: trust the model's claimed number only if it actually
    // falls in this batch's range; otherwise fall back to position.
    const resolvedPageNumber =
      claimedPageNumber !== undefined && validPageNumbers.has(claimedPageNumber)
        ? claimedPageNumber
        : pageNumber;

    pages.push({
      pageNumber: resolvedPageNumber,
      markdown: typeof raw.markdown === "string" ? raw.markdown : "",
      sectionPath: typeof raw.sectionPath === "string" ? raw.sectionPath : null,
      hasVisuals: raw.hasVisuals === true,
    });
  }

  return pages;
}
