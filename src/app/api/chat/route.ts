import { requireConversation, requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { extractCitations } from "@/lib/chat/citations";
import { GENERATION_CONFIG, prepareChatTurn } from "@/lib/chat/generate";
import { INSUFFICIENT_EVIDENCE_MESSAGE } from "@/lib/chat/prompt";
import { getGeminiClient, withRetry } from "@/lib/gemini/client";
import { serverEnv } from "@/lib/config/server-env";
import { RAG_CONFIG } from "@/lib/config/rag";
import { badRequest } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { checkRateLimit } from "@/lib/ratelimit/check";
import { normalizeQuery } from "@/lib/retrieval/normalize";
import { chatRequestSchema } from "@/lib/validation/chat";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 60;

function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();

    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest("Invalid chat request", parsed.error.flatten());
    }

    const { knowledgeBaseId } = parsed.data;
    await requireKnowledgeBase(supabase, workspaceId, knowledgeBaseId);

    await checkRateLimit(supabase, {
      workspaceId,
      bucket: "chat-minute",
      limit: 20,
      windowMs: 60_000,
      friendlyMessage: "You're sending messages too quickly. Please wait a moment and try again.",
    });
    await checkRateLimit(supabase, {
      workspaceId,
      bucket: "chat-day",
      limit: 300,
      windowMs: 24 * 60 * 60_000,
      friendlyMessage: "You've reached today's message limit for this workspace.",
    });

    let conversationId = parsed.data.conversationId;
    if (conversationId) {
      await requireConversation(supabase, workspaceId, knowledgeBaseId, conversationId);
    } else {
      const { data: newConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          knowledge_base_id: knowledgeBaseId,
          workspace_id: workspaceId,
          title: parsed.data.message.slice(0, 80),
        })
        .select("id")
        .single();
      if (createError) throw createError;
      conversationId = newConversation.id;
    }

    const normalizedMessage = normalizeQuery(parsed.data.message);

    const { data: historyRows, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(RAG_CONFIG.historyMessages);
    if (historyError) throw historyError;

    const history = (historyRows ?? []).map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content as string,
    }));

    const { error: userMessageError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      workspace_id: workspaceId,
      role: "user",
      content: normalizedMessage,
    });
    if (userMessageError) throw userMessageError;

    if (!conversationId) {
      throw new Error("conversationId was not resolved");
    }
    const finalConversationId: string = conversationId;
    const stream = buildChatStream({
      supabase,
      workspaceId,
      knowledgeBaseId,
      conversationId: finalConversationId,
      message: normalizedMessage,
      history,
      signal: request.signal,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });
}

function buildChatStream(params: {
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
        const MAX_STREAM_ATTEMPTS = 3;
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
            console.warn(
              `Chat generation attempt ${attempt + 1} failed before any output, retrying:`,
              streamError instanceof Error ? streamError.message : streamError,
            );
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
        const message = error instanceof Error ? error.message : "Generation failed";
        controller.enqueue(
          sseEvent("error", {
            code: "GENERATION_FAILED",
            message: "The response was cut short. Try asking again.",
          }),
        );
        console.error("Chat stream error:", message);
        controller.close();
      }
    },
  });
}

async function persistTurn(
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
