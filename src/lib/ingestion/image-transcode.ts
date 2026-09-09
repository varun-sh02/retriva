import "server-only";
import sharp from "sharp";

/**
 * WebP is transcoded to PNG before any Gemini call (ADR-011): a reported
 * issue indicates gemini-embedding-2's embedContent endpoint has accepted
 * only PNG/JPEG for some model versions, and the stable model's exact image
 * MIME allowlist isn't documented. Transcoding removes the dependency on
 * that undocumented list entirely. The original WebP bytes are untouched —
 * this returns a second, derived buffer only.
 */
export async function transcodeToPngIfNeeded(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (mimeType !== "image/webp") {
    return { buffer, mimeType };
  }

  const pngBuffer = await sharp(buffer).png().toBuffer();
  return { buffer: pngBuffer, mimeType: "image/png" };
}
