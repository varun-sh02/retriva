import "server-only";
import { serverEnv } from "@/lib/config/server-env";
import { getGeminiClient, withRetry } from "./client";

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Index-time and query-time prefixes MUST stay in this one shared module.
 * A mismatch between how a chunk was embedded and how a query is embedded
 * silently degrades every search (docs/rag-pipeline.md §2.2/§3.3) — there
 * is deliberately no second place these strings are built.
 */
export function buildIndexText(params: {
  documentName: string;
  sectionPath: string | null;
  content: string;
}): string {
  const sectionPart = params.sectionPath ?? "";
  return `title: ${params.documentName} | text: ${sectionPart}\n${params.content}`;
}

export function buildQueryText(query: string): string {
  return `task: question answering | query: ${query}`;
}

async function embedContentValues(
  contents: Parameters<ReturnType<typeof getGeminiClient>["models"]["embedContent"]>[0]["contents"],
): Promise<number[]> {
  const ai = getGeminiClient();

  const response = await withRetry(() =>
    ai.models.embedContent({
      model: serverEnv.GEMINI_EMBEDDING_MODEL,
      contents,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    }),
  );

  const vector = response.embeddings?.[0]?.values;
  if (!vector) {
    throw new Error("Gemini embedContent returned no embedding values");
  }
  return vector;
}

export function embedText(text: string): Promise<number[]> {
  return embedContentValues(text);
}

export function embedImage(buffer: Buffer, mimeType: string): Promise<number[]> {
  return embedContentValues([
    { inlineData: { mimeType, data: buffer.toString("base64") } },
  ]);
}

/**
 * Embeds many texts with a bounded worker pool — the free tier is
 * rate-limited (~100 RPM), and withRetry already backs off individual
 * 429s, so a small fixed concurrency (not unbounded Promise.all) is what
 * keeps a large document from immediately tripping the limit.
 */
export async function embedTextBatch(texts: string[], concurrency = 4): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= texts.length) return;
      const text = texts[currentIndex];
      if (text === undefined) continue;
      results[currentIndex] = await embedText(text);
    }
  }

  const workerCount = Math.min(concurrency, texts.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
