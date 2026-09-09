import "server-only";
import { FileState } from "@google/genai";
import { getGeminiClient, withRetry } from "./client";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60_000;

export type UploadedGeminiFile = {
  uri: string;
  name: string;
  expiresAt: Date | null;
};

/**
 * Uploads a buffer to the Gemini Files API and waits for it to become
 * ACTIVE. Files API is scratch-only, 48h lifetime — never the source of
 * truth (docs/architecture.md §1; Supabase Storage holds the original).
 */
export async function uploadToGeminiFiles(
  buffer: Buffer,
  mimeType: string,
): Promise<UploadedGeminiFile> {
  const ai = getGeminiClient();

  const file = await withRetry(() =>
    ai.files.upload({
      file: new Blob([new Uint8Array(buffer)], { type: mimeType }),
      config: { mimeType },
    }),
  );

  if (!file.name) {
    throw new Error("Gemini Files API upload did not return a file name");
  }

  const active = await pollUntilActive(file.name);

  if (!active.uri) {
    throw new Error("Gemini file became ACTIVE but has no uri");
  }

  return {
    uri: active.uri,
    name: active.name ?? file.name,
    expiresAt: active.expirationTime ? new Date(active.expirationTime) : null,
  };
}

async function pollUntilActive(name: string) {
  const ai = getGeminiClient();
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (true) {
    const file = await withRetry(() => ai.files.get({ name }));

    if (file.state === FileState.ACTIVE) {
      return file;
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini file processing failed: ${file.error?.message ?? "unknown error"}`);
    }

    if (Date.now() > deadline) {
      throw new Error(`Gemini file did not become ACTIVE within ${POLL_TIMEOUT_MS}ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
