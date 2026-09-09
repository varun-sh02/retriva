import "server-only";
import type { SourceMapEntry } from "./context";

export type Citation = {
  sourceId: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  contentType: string;
  excerpt: string;
  pageNumber: number | null;
  startTimestamp: number | null;
  endTimestamp: number | null;
  sectionPath: string | null;
  score: number;
};

const EXCERPT_LENGTH = 240;

// Tolerant of punctuation drift ([SOURCE_1], (SOURCE_1), SOURCE 1, source_1)
// while validation stays strict: only a label present in `sourceMap` —
// issued by the server for this turn — becomes a real citation.
const CITATION_PATTERN = /[[(]?\s*SOURCE[_\s]?(\d+)\s*[\])]?/gi;

/**
 * The model contributes only the integer `n`. Every other field — filename,
 * page, timestamp, excerpt — is read from the server's own map, never from
 * model output (docs/rag-pipeline.md §7, docs/security.md T6). A reference
 * to a label not issued this turn is stripped, not rendered.
 */
export function extractCitations(
  answerText: string,
  sourceMap: Map<string, SourceMapEntry>,
): { citations: Citation[]; cleanedText: string; violations: number } {
  const citations: Citation[] = [];
  const seen = new Set<string>();
  let violations = 0;

  const cleanedText = answerText.replace(CITATION_PATTERN, (_match, num: string) => {
    const sourceId = `SOURCE_${num}`;
    const chunk = sourceMap.get(sourceId);

    if (!chunk) {
      violations += 1;
      return "";
    }

    if (!seen.has(sourceId)) {
      seen.add(sourceId);
      citations.push({
        sourceId,
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        contentType: chunk.contentType,
        excerpt: chunk.content.slice(0, EXCERPT_LENGTH),
        pageNumber: chunk.pageNumber,
        startTimestamp: chunk.startTimestamp,
        endTimestamp: chunk.endTimestamp,
        sectionPath: chunk.sectionPath,
        score: chunk.score,
      });
    }

    return `[${sourceId}]`;
  });

  return { citations, cleanedText, violations };
}
