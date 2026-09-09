import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/config/server-env";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey: serverEnv.GEMINI_API_KEY });
  }
  return cachedClient;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Retries transient Gemini API failures (rate limits, upstream 5xx) with
 * exponential backoff + jitter. Non-retryable errors (4xx other than 429)
 * throw immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isRetryable = error instanceof ApiError && RETRYABLE_STATUS.has(error.status);
      if (!isRetryable || attempt === maxAttempts - 1) {
        throw error;
      }

      const delayMs = 2 ** attempt * 500 + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
