import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/config/server-env";
import { RAG_CONFIG } from "@/lib/config/rag";
import { getGeminiClient, withRetry } from "@/lib/gemini/client";
import { buildQueryText, embedText } from "@/lib/gemini/embeddings";
import { type HistoryTurn, rewriteQuery } from "@/lib/retrieval/rewrite";
import { retrieveChunks } from "@/lib/retrieval/search";
import { type Citation, extractCitations } from "./citations";
import { assembleContext, type SourceMapEntry } from "./context";
import { buildUserTurn, INSUFFICIENT_EVIDENCE_MESSAGE, SYSTEM_PROMPT } from "./prompt";

export type RetrievalLog = {
  rawQuery: string;
  rewrittenQuery: string;
  retrieved: { chunkId: string; documentId: string; score: number }[];
  model: string;
};

export type ChatTurnResult = {
  answer: string;
  citations: Citation[];
  refused: boolean;
  retrievalLog: RetrievalLog & { citationViolations: number };
};

/** Refused before any generation call — retrieval gate tripped (docs/rag-pipeline.md §3.5). */
type PreparedRefusal = { refused: true; retrievalLog: RetrievalLog };
/** Ready to generate — contents/config for generateContent(Stream) plus the source map to resolve citations against. */
type PreparedGeneration = {
  refused: false;
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
  sourceMap: Map<string, SourceMapEntry>;
  retrievalLog: RetrievalLog;
};

function historyToContents(history: HistoryTurn[]) {
  return history.map((turn) => ({
    role: turn.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: turn.content }],
  }));
}

/**
 * rewrite → embed → retrieve → gate → assemble (docs/rag-pipeline.md §1).
 * Shared by both the non-streaming and streaming chat paths so the RAG logic
 * exists in exactly one place regardless of transport.
 */
export async function prepareChatTurn(
  supabase: SupabaseClient,
  params: { workspaceId: string; knowledgeBaseId: string; message: string; history: HistoryTurn[] },
): Promise<PreparedRefusal | PreparedGeneration> {
  const rewrittenQuery = await rewriteQuery(params.message, params.history);
  const queryVector = await embedText(buildQueryText(rewrittenQuery));

  const chunks = await retrieveChunks(supabase, {
    workspaceId: params.workspaceId,
    knowledgeBaseId: params.knowledgeBaseId,
    queryVector,
    topK: RAG_CONFIG.topK,
    scoreThreshold: RAG_CONFIG.scoreThreshold,
    maxChunksPerDocument: RAG_CONFIG.maxChunksPerDocument,
    finalContextChunks: RAG_CONFIG.finalContextChunks,
  });

  const retrievalLog: RetrievalLog = {
    rawQuery: params.message,
    rewrittenQuery,
    retrieved: chunks.map((c) => ({ chunkId: c.chunkId, documentId: c.documentId, score: c.score })),
    model: serverEnv.GEMINI_MODEL,
  };

  if (chunks.length === 0) {
    return { refused: true, retrievalLog };
  }

  const { promptBlock, sourceMap } = assembleContext(chunks);
  const userTurn = buildUserTurn(promptBlock, rewrittenQuery);

  return {
    refused: false,
    contents: [...historyToContents(params.history), { role: "user", parts: [{ text: userTurn }] }],
    sourceMap,
    retrievalLog,
  };
}

export const GENERATION_CONFIG = {
  systemInstruction: SYSTEM_PROMPT,
  temperature: 0.2,
  maxOutputTokens: 2048,
} as const;

/** Non-streaming turn — kept for contexts that don't need SSE (e.g. tests, evals). */
export async function generateChatTurn(
  supabase: SupabaseClient,
  params: { workspaceId: string; knowledgeBaseId: string; message: string; history: HistoryTurn[] },
): Promise<ChatTurnResult> {
  const prepared = await prepareChatTurn(supabase, params);

  if (prepared.refused) {
    return {
      answer: INSUFFICIENT_EVIDENCE_MESSAGE,
      citations: [],
      refused: true,
      retrievalLog: { ...prepared.retrievalLog, citationViolations: 0 },
    };
  }

  const ai = getGeminiClient();
  const response = await withRetry(() =>
    ai.models.generateContent({
      model: serverEnv.GEMINI_MODEL,
      contents: prepared.contents,
      config: GENERATION_CONFIG,
    }),
  );

  const { citations, cleanedText, violations } = extractCitations(
    response.text ?? "",
    prepared.sourceMap,
  );

  return {
    answer: cleanedText,
    citations,
    refused: cleanedText.trim() === INSUFFICIENT_EVIDENCE_MESSAGE,
    retrievalLog: { ...prepared.retrievalLog, citationViolations: violations },
  };
}
