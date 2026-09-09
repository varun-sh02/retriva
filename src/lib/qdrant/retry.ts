import "server-only";

/**
 * Retries transient network failures against Qdrant Cloud (found via real
 * testing: a single "fetch failed" permanently failed a document at the
 * INDEXING stage with no retry anywhere in the Qdrant path, unlike Gemini
 * calls which already use lib/gemini/client.ts's withRetry). Qdrant's own
 * client throws plain Error/TypeError on network failures, not a typed
 * status-carrying error like @google/genai's ApiError, so this retries on
 * the message patterns Node's fetch actually produces for a dropped
 * connection rather than on a status code.
 */
export async function withQdrantRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const message = error instanceof Error ? error.message : String(error);
      const isRetryable = /fetch failed|ECONNRESET|ETIMEDOUT|network|timeout/i.test(message);
      if (!isRetryable || attempt === maxAttempts - 1) {
        throw error;
      }

      const delayMs = 2 ** attempt * 500 + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
