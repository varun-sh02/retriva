import "server-only";
import type { ExtractedPage } from "./pdf";

export type ChunkerConfig = {
  targetTokens: number;
  overlapTokens: number;
  minTokens: number;
  maxTokens: number;
};

export const DEFAULT_CHUNKER_CONFIG: ChunkerConfig = {
  targetTokens: 700,
  overlapTokens: 100,
  minTokens: 80,
  maxTokens: 6000,
};

export type TextChunk = {
  content: string;
  sectionPath: string | null;
};

/**
 * ~4 characters/token for English text — a standard rough approximation.
 * Used only for chunk-boundary decisions, not for billing/limit enforcement,
 * where it would need to be exact.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type Section = { sectionPath: string | null; content: string };

const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

/**
 * Splits markdown-ish text into sections by heading lines, tracking the
 * heading stack to build each section's dot path (e.g.
 * "Architecture > Persistence > Database"). Content before the first
 * heading becomes a section with sectionPath: null.
 */
function splitIntoSections(text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  const headingStack: { level: number; title: string }[] = [];

  let currentContent: string[] = [];

  function pathFromStack(): string | null {
    return headingStack.length > 0 ? headingStack.map((h) => h.title).join(" > ") : null;
  }

  function flush() {
    const content = currentContent.join("\n").trim();
    if (content.length > 0) {
      sections.push({ sectionPath: pathFromStack(), content });
    }
    currentContent = [];
  }

  for (const line of lines) {
    const match = line.match(HEADING_PATTERN);
    if (match) {
      flush();
      const level = match[1]?.length ?? 1;
      const title = match[2]?.trim() ?? "";
      while (headingStack.length > 0 && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, title });
      continue;
    }
    currentContent.push(line);
  }
  flush();

  return sections;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

const SENTENCE_PATTERN = /[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g;

function splitIntoSentences(text: string): string[] {
  const matches = text.match(SENTENCE_PATTERN);
  if (!matches) return [text];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

function hardSplit(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    parts.push(text.slice(i, i + maxChars));
  }
  return parts;
}

/** Last ~overlapTokens worth of characters from the end of `text`. */
function takeOverlapSuffix(text: string, overlapTokens: number): string {
  const overlapChars = overlapTokens * 4;
  if (text.length <= overlapChars) return text;
  return text.slice(text.length - overlapChars);
}

/** Greedily accumulates already-right-sized units up to targetTokens per piece. */
function greedyAccumulate(units: string[], separator: string, targetTokens: number): string[] {
  const pieces: string[] = [];
  let current = "";

  function pushCurrent() {
    if (current.length > 0) pieces.push(current);
    current = "";
  }

  for (const unit of units) {
    const candidate = current.length > 0 ? `${current}${separator}${unit}` : unit;
    if (estimateTokens(candidate) > targetTokens && current.length > 0) {
      pushCurrent();
      current = unit;
    } else {
      current = candidate;
    }
  }
  pushCurrent();

  return pieces;
}

/**
 * Splits one section's content into target-sized pieces: paragraphs are
 * accumulated greedily up to targetTokens. A paragraph that alone exceeds
 * maxTokens is expanded into sentences, which are re-accumulated toward
 * targetTokens rather than each becoming its own tiny piece; a sentence
 * that alone still exceeds maxTokens is hard-split by character count and
 * those parts re-accumulated the same way. Adjacent pieces below minTokens
 * are merged afterward.
 */
export function chunkSectionContent(content: string, config: ChunkerConfig): string[] {
  const paragraphs = splitIntoParagraphs(content);

  const expandedUnits: string[] = [];
  for (const paragraph of paragraphs) {
    if (estimateTokens(paragraph) <= config.maxTokens) {
      expandedUnits.push(paragraph);
      continue;
    }

    const expandedSentences: string[] = [];
    for (const sentence of splitIntoSentences(paragraph)) {
      if (estimateTokens(sentence) <= config.maxTokens) {
        expandedSentences.push(sentence);
      } else {
        expandedSentences.push(
          ...greedyAccumulate(hardSplit(sentence, config.maxTokens), "", config.targetTokens),
        );
      }
    }
    expandedUnits.push(...greedyAccumulate(expandedSentences, " ", config.targetTokens));
  }

  const pieces = greedyAccumulate(expandedUnits, "\n\n", config.targetTokens);
  return mergeUndersized(pieces, config.minTokens);
}

function mergeUndersized(pieces: string[], minTokens: number): string[] {
  const merged: string[] = [];
  for (const piece of pieces) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && estimateTokens(previous) < minTokens) {
      merged[merged.length - 1] = `${previous}\n\n${piece}`;
    } else {
      merged.push(piece);
    }
  }
  // A final undersized piece has no "next" to merge forward into — merge it
  // backward into the previous one instead, so it isn't left stranded alone.
  if (merged.length > 1) {
    const last = merged[merged.length - 1]!;
    if (estimateTokens(last) < minTokens) {
      merged[merged.length - 2] = `${merged[merged.length - 2]}\n\n${last}`;
      merged.pop();
    }
  }
  return merged;
}

/**
 * Full text → chunks: heading-based sectioning first (docs/rag-pipeline.md
 * §2.1), each section's content chunked by size, overlap applied between
 * consecutive chunks within the same section.
 */
export function chunkText(
  text: string,
  config: ChunkerConfig = DEFAULT_CHUNKER_CONFIG,
): TextChunk[] {
  const sections = splitIntoSections(text);
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    const pieces = chunkSectionContent(section.content, config);

    pieces.forEach((piece, index) => {
      // sectionPath is stored as its own field (chunks.section_path) and
      // applied as an embedding-time prefix (rag-pipeline.md §2.2) — it is
      // NOT baked into content here, which stays the clean text a citation
      // excerpt quotes verbatim.
      const overlapPrefix =
        index > 0 ? `${takeOverlapSuffix(pieces[index - 1]!, config.overlapTokens)}\n\n` : "";

      chunks.push({
        content: `${overlapPrefix}${piece}`.trim(),
        sectionPath: section.sectionPath,
      });
    });
  }

  return chunks;
}

export type PdfChunk = {
  content: string;
  sectionPath: string | null;
  pageNumber: number;
  /** Set only when a min-size merge folded multiple pages into one chunk. */
  pageRangeEnd: number | null;
};

/**
 * Groups consecutive pages so no group's combined content falls under
 * minTokens — the only case a PDF chunk is allowed to span more than one
 * page (docs/multimodal-ingestion.md §1). A trailing undersized group
 * merges backward, since it has no "next" page to fold into.
 */
function groupPagesForMinSize(pages: ExtractedPage[], minTokens: number): ExtractedPage[][] {
  const groups: ExtractedPage[][] = [];

  for (const page of pages) {
    const previousGroup = groups[groups.length - 1];
    const previousTokens = previousGroup
      ? estimateTokens(previousGroup.map((p) => p.markdown).join("\n\n"))
      : Infinity;

    if (previousGroup && previousTokens < minTokens) {
      previousGroup.push(page);
    } else {
      groups.push([page]);
    }
  }

  if (groups.length > 1) {
    const lastGroup = groups[groups.length - 1]!;
    const lastTokens = estimateTokens(lastGroup.map((p) => p.markdown).join("\n\n"));
    if (lastTokens < minTokens) {
      groups[groups.length - 2]!.push(...lastGroup);
      groups.pop();
    }
  }

  return groups;
}

/**
 * Page-aware chunking: a chunk never spans a page boundary except via the
 * min-size merge above, in which case it records a page range instead of
 * falsely claiming a single page. A single page whose own content exceeds
 * maxTokens is split further, with every resulting piece still tagged with
 * that same page (or range) — splitting never merges across groups.
 */
export function chunkPdfPages(
  pages: ExtractedPage[],
  config: ChunkerConfig = DEFAULT_CHUNKER_CONFIG,
): PdfChunk[] {
  const groups = groupPagesForMinSize(pages, config.minTokens);
  const chunks: PdfChunk[] = [];

  for (const group of groups) {
    const firstPage = group[0]!.pageNumber;
    const lastPage = group[group.length - 1]!.pageNumber;
    const sectionPath = group[0]!.sectionPath;
    const content = group.map((p) => p.markdown).join("\n\n");
    const pageRangeEnd = lastPage !== firstPage ? lastPage : null;

    const pieces =
      estimateTokens(content) <= config.maxTokens
        ? [content]
        : chunkSectionContent(content, config);

    for (const piece of pieces) {
      chunks.push({ content: piece, sectionPath, pageNumber: firstPage, pageRangeEnd });
    }
  }

  return chunks;
}
