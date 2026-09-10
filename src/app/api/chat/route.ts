import { requireConversation, requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { buildHistory } from "@/lib/chat/history";
import { buildChatStream } from "@/lib/chat/stream";
import { RAG_CONFIG } from "@/lib/config/rag";
import { badRequest } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { checkRateLimit } from "@/lib/ratelimit/check";
import { normalizeQuery } from "@/lib/retrieval/normalize";
import { chatRequestSchema } from "@/lib/validation/chat";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();

    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      // Lead with the specific reason. A bare "Invalid chat request" told the
      // user nothing — a message a few hundred characters over the cap looked
      // identical to a malformed body, and the actionable detail sat unread in
      // `details` because the client only renders `message`.
      const reason = parsed.error.issues[0]?.message;
      throw badRequest(
        reason ? `Invalid chat request: ${reason}` : "Invalid chat request",
        parsed.error.flatten(),
      );
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

    // Ordering matters: `ascending: true` + `.limit()` would return the
    // OLDEST N rows, freezing the window on the opening turns once a
    // conversation passes N messages. Take the newest N, then flip back into
    // chronological order. Over-fetch because buildHistory discards
    // incomplete and refused exchanges (see src/lib/chat/history.ts).
    const { data: historyRows, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(RAG_CONFIG.historyMessages * 3);
    if (historyError) throw historyError;

    const history = buildHistory(
      (historyRows ?? []).reverse().map((row) => ({
        role: row.role as "user" | "assistant",
        content: row.content as string,
      })),
      RAG_CONFIG.historyMessages,
    );

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
