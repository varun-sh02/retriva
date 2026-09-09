import "server-only";
import type { RetrievedChunk } from "@/lib/retrieval/search";

export type SourceMapEntry = RetrievedChunk & { sourceId: string };

/**
 * Strips the literal delimiter tags from chunk content before it enters the
 * prompt, so a malicious document can't close `<knowledge_context>` early
 * and escape into instruction position (docs/security.md T3).
 */
function neutralizeDelimiters(content: string): string {
  return content.replace(/<\/?knowledge_context>/gi, "");
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Builds the SOURCE_n-labeled context block and the server-owned map from
 * label to real evidence (docs/rag-pipeline.md §4/§7). The model is never
 * given anything but the labels — filenames, pages, and timestamps come
 * back from this map, not from model output.
 */
export function assembleContext(chunks: RetrievedChunk[]): {
  promptBlock: string;
  sourceMap: Map<string, SourceMapEntry>;
} {
  const sourceMap = new Map<string, SourceMapEntry>();
  const blocks: string[] = [];

  chunks.forEach((chunk, index) => {
    const sourceId = `SOURCE_${index + 1}`;
    sourceMap.set(sourceId, { ...chunk, sourceId });

    const locationLine =
      chunk.pageNumber !== null
        ? `Page: ${chunk.pageNumber}`
        : chunk.startTimestamp !== null && chunk.endTimestamp !== null
          ? `Time: ${formatTimestamp(chunk.startTimestamp)}–${formatTimestamp(chunk.endTimestamp)}`
          : null;

    blocks.push(
      [
        `[${sourceId}]`,
        `Document: ${chunk.documentName}`,
        `Type: ${chunk.contentType}`,
        locationLine,
        "Content:",
        neutralizeDelimiters(chunk.content),
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    );
  });

  return { promptBlock: blocks.join("\n\n"), sourceMap };
}
