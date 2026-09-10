import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractCitations } from "@/lib/chat/citations";
import { GENERATION_CONFIG, prepareChatTurn } from "@/lib/chat/generate";
import { INSUFFICIENT_EVIDENCE_MESSAGE } from "@/lib/chat/prompt";
import { serverEnv } from "@/lib/config/server-env";
import { getGeminiClient, withRetry } from "@/lib/gemini/client";

/**
 * The SSE chat turn, shared by the authenticated route (/api/chat) and the
 * public widget route (/api/public/chat).
 *
 * Both callers reach this with a workspace id and knowledge base id the
 * SERVER resolved — from a verified session in one case, from a share token
 * in the other. Neither ever takes those ids from request input, so the
 * isolation contract is identical on both paths and the RAG pipeline below
 * needs no notion of which one it is serving.
 */

function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Node's fetch (undici) wraps network failures in a TypeError whose
// .message is just "fetch failed" — the actionable detail (DNS failure,
// connect timeout, socket reset) lives on .cause. Walk the chain so logs
// show the real reason instead of the generic wrapper text.
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts = [error.message];
  let cause = error.cause;
  while (cause) {
    parts.push(cause instanceof Error ? cause.message : String(cause));
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return parts.join(" <- caused by: ");
}

export function buildChatStream(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  knowledgeBaseId: string;
  conversationId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  signal: AbortSignal;
}): ReadableStream<Uint8Array> {
  const { supabase, workspaceId, knowledgeBaseId, conversationId, message, history, signal } = params;

  return new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      controller.enqueue(sseEvent("meta", { conversationId }));

      try {
        controller.enqueue(sseEvent("status", { phase: "searching" }));
        const prepared = await prepareChatTurn(supabase, {
          workspaceId,
          knowledgeBaseId,
          message,
          history,
        });

        if (prepared.refused) {
          await persistTurn(supabase, {
            conversationId,
            workspaceId,
            knowledgeBaseId,
            answer: INSUFFICIENT_EVIDENCE_MESSAGE,
            citations: [],
            retrievalLog: prepared.retrievalLog,
            latencyMs: Date.now() - startedAt,
            interrupted: false,
          });
          controller.enqueue(sseEvent("delta", { text: INSUFFICIENT_EVIDENCE_MESSAGE }));
          controller.enqueue(sseEvent("citations", { citations: [] }));
          controller.enqueue(sseEvent("done", { usage: { latencyMs: Date.now() - startedAt } }));
          controller.close();
          return;
        }

        // Retrieval-transparency data (docs/rag-pipeline.md §34 / TASK-068):
        // the FULL retrieved set with scores, not just what ends up cited —
        // emitted before generation so the client can show it immediately
        // behind an off-by-default toggle.
        controller.enqueue(
          sseEvent("sources", {
            sources: Array.from(prepared.sourceMap.values()).map((entry) => ({
              sourceId: entry.sourceId,
              documentName: entry.documentName,
              contentType: entry.contentType,
              pageNumber: entry.pageNumber,
              startTimestamp: entry.startTimestamp,
              endTimestamp: entry.endTimestamp,
              score: entry.score,
            })),
          }),
        );

        controller.enqueue(sseEvent("status", { phase: "synthesizing" }));

        const ai = getGeminiClient();

        // withRetry only covers *starting* generateContentStream — a
        // network hiccup while iterating the returned stream (a real,
        // repeatedly observed "fetch failed" from Node's fetch — the same
        // transient class hit with Qdrant during this build) previously
        // wasn't retried at all and surfaced immediately as "response was
        // cut short." This loop retries the *whole* stream from scratch,
        // but only while nothing has reached the client yet: once a delta
        // has been emitted, retrying would duplicate or garble what the
        // user already sees, so a failure past that point still falls
        // through to the outer catch instead.
        const MAX_STREAM_ATTEMPTS = 4;
        let fullText = "";

        for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS; attempt++) {
          try {
            const responseStream = await withRetry(() =>
              ai.models.generateContentStream({
                model: serverEnv.GEMINI_MODEL,
                contents: prepared.contents,
                config: GENERATION_CONFIG,
              }),
            );

            for await (const chunk of responseStream) {
              if (signal.aborted) break;
              const text = chunk.text;
              if (text) {
                fullText += text;
                controller.enqueue(sseEvent("delta", { text }));
              }
            }
            break;
          } catch (streamError) {
            const isLastAttempt = attempt === MAX_STREAM_ATTEMPTS - 1;
            if (fullText.length > 0 || isLastAttempt) {
              throw streamError;
            }
            // withRetry() above only retries ApiError instances with a
            // retryable status — a raw network-level failure (e.g. Node
            // undici's "fetch failed", which wraps the real cause in
            // `.cause` rather than `.message`) is NOT retried by withRetry
            // and throws on its first attempt, landing here immediately.
            // Log the cause chain so a future occurrence is diagnosable
            // instead of showing up only as the opaque top-level message.
            console.warn(
              `Chat generation attempt ${attempt + 1}/${MAX_STREAM_ATTEMPTS} failed before any output, retrying:`,
              describeError(streamError),
            );
            const backoffMs = 300 * (attempt + 1);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
        }

        const interrupted = signal.aborted;
        const { citations, cleanedText, violations } = extractCitations(fullText, prepared.sourceMap);

        await persistTurn(supabase, {
          conversationId,
          workspaceId,
          knowledgeBaseId,
          answer: cleanedText,
          citations,
          retrievalLog: { ...prepared.retrievalLog, citationViolations: violations },
          latencyMs: Date.now() - startedAt,
          interrupted,
        });

        if (!interrupted) {
          controller.enqueue(sseEvent("citations", { citations }));
          controller.enqueue(sseEvent("done", { usage: { latencyMs: Date.now() - startedAt } }));
        }
        controller.close();
      } catch (error) {
        controller.enqueue(
          sseEvent("error", {
            code: "GENERATION_FAILED",
            message: "The response was cut short. Try asking again.",
          }),
        );
        console.error("Chat stream error:", describeError(error));
        controller.close();
      }
    },
  });
}

export async function persistTurn(
  supabase: SupabaseClient,
  params: {
    conversationId: string;
    workspaceId: string;
    knowledgeBaseId: string;
    answer: string;
    citations: ReturnType<typeof extractCitations>["citations"];
    retrievalLog: {
      rawQuery: string;
      rewrittenQuery: string;
      retrieved: { chunkId: string; documentId: string; score: number }[];
      model: string;
      citationViolations?: number;
    };
    latencyMs: number;
    interrupted: boolean;
  },
) {
  const citationsJson = params.citations.map((c) => ({
    sourceId: c.sourceId,
    chunkId: c.chunkId,
    documentId: c.documentId,
    documentName: c.documentName,
    contentType: c.contentType,
    excerpt: c.excerpt,
    pageNumber: c.pageNumber,
    startTimestamp: c.startTimestamp,
    endTimestamp: c.endTimestamp,
    sectionPath: c.sectionPath,
    score: c.score,
  }));

  const { data: assistantMessage, error: assistantError } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      workspace_id: params.workspaceId,
      role: "assistant",
      content: params.answer,
      citations: citationsJson,
      usage: { latencyMs: params.latencyMs, model: params.retrievalLog.model },
      interrupted: params.interrupted,
    })
    .select("id")
    .single();
  if (assistantError) throw assistantError;

  if (params.citations.length > 0) {
    await supabase.from("citations").insert(
      params.citations.map((c) => ({
        message_id: assistantMessage.id,
        chunk_id: c.chunkId,
        document_id: c.documentId,
        source_label: c.sourceId,
        excerpt: c.excerpt,
        score: c.score,
      })),
    );
  }

  await supabase.from("retrieval_logs").insert({
    conversation_id: params.conversationId,
    message_id: assistantMessage.id,
    knowledge_base_id: params.knowledgeBaseId,
    workspace_id: params.workspaceId,
    raw_query: params.retrievalLog.rawQuery,
    rewritten_query: params.retrievalLog.rewrittenQuery,
    retrieved: params.retrievalLog.retrieved,
    model: params.retrievalLog.model,
    latency_ms: params.latencyMs,
  });

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.conversationId);
}
