import "server-only";

export type TextExtractionResult = {
  text: string;
};

/**
 * Plain text — no headings, no Gemini call. Decoding failure (invalid
 * UTF-8) is a real signal the "text file" isn't actually text; it's
 * rejected rather than silently mangled.
 */
export function extractText(buffer: Buffer): TextExtractionResult {
  const decoder = new TextDecoder("utf-8", { fatal: true });

  let text: string;
  try {
    text = decoder.decode(buffer);
  } catch {
    throw new Error("File is not valid UTF-8 text.");
  }

  return { text };
}
