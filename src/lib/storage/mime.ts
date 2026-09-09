import "server-only";
import { fileTypeFromBuffer } from "file-type";

export type ContentType = "pdf" | "docx" | "text" | "markdown" | "image" | "video";

const MIME_TO_CONTENT_TYPE: Record<string, ContentType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "text",
  "text/markdown": "markdown",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_TO_CONTENT_TYPE);

// file-type has no magic-byte signature for plain text — there isn't one.
// These are the only two mime types eligible for the text-content fallback
// check below.
const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown"]);

export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType in MIME_TO_CONTENT_TYPE;
}

export function contentTypeForMime(mimeType: string): ContentType {
  const contentType = MIME_TO_CONTENT_TYPE[mimeType];
  if (!contentType) {
    throw new Error(`No content type mapping for mime type "${mimeType}"`);
  }
  return contentType;
}

export type MimeDetectionResult =
  | { ok: true; mimeType: string; contentType: ContentType }
  | { ok: false; reason: string };

/**
 * Sniffs the real type of a file's bytes. The declared/uploaded
 * Content-Type is never trusted on its own (docs/security.md T4) — this is
 * what confirm routes call before accepting an upload.
 */
export async function detectMimeType(
  buffer: Buffer,
  declaredMimeType: string,
): Promise<MimeDetectionResult> {
  const detected = await fileTypeFromBuffer(buffer);

  if (detected) {
    if (!isAllowedMimeType(detected.mime)) {
      return { ok: false, reason: `Detected type "${detected.mime}" is not supported.` };
    }
    return {
      ok: true,
      mimeType: detected.mime,
      contentType: contentTypeForMime(detected.mime),
    };
  }

  // No magic-byte signature found. This is expected and correct for real
  // plain text/markdown — but also for arbitrary binary junk, so this branch
  // still verifies content, it does not just trust the declared type.
  if (TEXT_MIME_TYPES.has(declaredMimeType) && looksLikeText(buffer)) {
    return {
      ok: true,
      mimeType: declaredMimeType,
      contentType: contentTypeForMime(declaredMimeType),
    };
  }

  return { ok: false, reason: "Could not verify this file's type from its content." };
}

function looksLikeText(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return true;
  }

  // A null byte never appears in valid UTF-8 text content; its presence is
  // the standard cheap signal that a file is binary.
  if (buffer.includes(0)) {
    return false;
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}
