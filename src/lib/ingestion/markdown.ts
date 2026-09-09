import "server-only";
import { extractText } from "./text";

export type MarkdownExtractionResult = {
  text: string;
  frontMatter: Record<string, string>;
};

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Markdown — no Gemini call. Strips a leading YAML front-matter block into
 * metadata; heading-tree walking (for chunk section_path) happens uniformly
 * across all modalities in the chunker (TASK-022), not here.
 *
 * Front-matter parsing is a flat `key: value` scan, not a real YAML parser
 * — deliberately, since this only feeds `documents.metadata` (not load-bearing
 * for retrieval). Nested/list front-matter values are not supported.
 */
export function extractMarkdown(buffer: Buffer): MarkdownExtractionResult {
  const { text: rawText } = extractText(buffer);

  const match = rawText.match(FRONT_MATTER_PATTERN);
  if (!match) {
    return { text: rawText, frontMatter: {} };
  }

  const frontMatterBlock = match[1] ?? "";
  const frontMatter: Record<string, string> = {};
  for (const line of frontMatterBlock.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      frontMatter[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return { text: rawText.slice(match[0].length), frontMatter };
}
