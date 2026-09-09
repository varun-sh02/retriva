import "server-only";
import mammoth from "mammoth";

export type DocxExtractionResult = {
  markdown: string;
  warnings: string[];
};

type MammothMarkdownResult = { value: string; messages: { message: string }[] };

// mammoth's shipped types (node_modules/mammoth/lib/index.d.ts) don't
// declare `convertToMarkdown`, even though it exists and works at runtime
// (verified directly against the installed package and its own test
// fixtures). Its export-assignment style doesn't support clean declaration
// merging, so this is a narrow, local cast rather than a global augmentation.
const convertToMarkdown = (
  mammoth as unknown as { convertToMarkdown: (input: { buffer: Buffer }) => Promise<MammothMarkdownResult> }
).convertToMarkdown;

/**
 * DOCX → markdown, no Gemini call. Gemini's document vision only
 * meaningfully understands PDFs (docs/multimodal-ingestion.md §2) — mammoth
 * reads the DOCX XML directly and preserves heading levels and lists well.
 *
 * Known gap (verified against mammoth's own test fixtures): mammoth's
 * default convertToMarkdown flattens tables to plain paragraph text rather
 * than GFM pipe-table syntax. Table structure is lost for DOCX; headings
 * and lists are not affected. Fixing this needs a custom style/element
 * transform, out of scope for this task.
 */
export async function extractDocx(buffer: Buffer): Promise<DocxExtractionResult> {
  const result = await convertToMarkdown({ buffer });

  return {
    markdown: result.value,
    warnings: result.messages.map((message) => message.message),
  };
}
