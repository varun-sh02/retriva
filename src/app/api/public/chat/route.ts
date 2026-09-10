import { buildHistory } from "@/lib/chat/history";
import { buildChatStream } from "@/lib/chat/stream";
import { RAG_CONFIG } from "@/lib/config/rag";
import { createSupabaseServiceClient } from "@/lib/db/service";
import { resolvePublicShare, resolveVisitorConversation } from "@/lib/auth/public-share";
import { badRequest } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { checkRateLimit } from "@/lib/ratelimit/check";
import { normalizeQuery } from "@/lib/retrieval/normalize";
import { publicChatRequestSchema } from "@/lib/validation/public-chat";

export const maxDuration = 60;

/**
 * Anonymous chat for the embeddable widget.
 *
 * The isolation contract is the same as /api/chat, reached a different way:
 * there, ids come from a verified session; here they come from a share token
 * the server resolves. In neither case does the caller supply them. Every
 * query below is filtered by the resolved pair, and searchChunks re-asserts
 * the workspace on results it gets back (docs/security.md T2).
 *
 * Because a visitor is anonymous, the meters below exist to keep one of them
 * from spending the owner's whole Gemini quota. Both are charged to the
 * OWNER's workspace — that is whose budget is at stake — but bucketed per
 * knowledge base, so a busy public widget cannot starve the owner's private
 * knowledge bases or their own signed-in chat.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await request.json().catch(() => null);
    const parsed = publicChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      const reason = parsed.error.issues[0]?.message;
      throw badRequest(
        reason ? `Invalid chat request: ${reason}` : "Invalid chat request",
        parsed.error.flatten(),
      );
    }

    const { shareToken, visitorId, message } = parsed.data;
    const share = await resolvePublicShare(shareToken);

    // Anonymous traffic never gets a session-bound client — there is no
    // session. Scoping is the explicit workspace/KB filters below.
    const supabase = createSupabaseServiceClient();

    await checkRateLimit(supabase, {
      workspaceId: share.workspaceId,
      bucket: `public:${share.knowledgeBaseId}:minute`,
      limit: 30,
      windowMs: 60_000,
      friendlyMessage: "This chat is busy right now. Please try again in a moment.",
    });
    await checkRateLimit(supabase, {
      workspaceId: share.workspaceId,
      bucket: `public:${share.knowledgeBaseId}:day`,
      limit: 500,
      windowMs: 24 * 60 * 60_000,
      friendlyMessage: "This chat has reached its daily limit. Please try again tomorrow.",
    });
    // Per-visitor meter on top of the per-widget one: without it a single
    // visitor could burn the whole shared allowance above on their own.
    await checkRateLimit(supabase, {
      workspaceId: share.workspaceId,
      bucket: `public:${share.knowledgeBaseId}:visitor:${visitorId}`,
      limit: 12,
      windowMs: 60_000,
      friendlyMessage: "You're sending messages too quickly. Please wait a moment.",
    });

    const normalizedMessage = normalizeQuery(message);

    const conversationId = await resolveVisitorConversation(supabase, {
      share,
      conversationId: parsed.data.conversationId,
      visitorId,
      title: normalizedMessage,
    });

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
      workspace_id: share.workspaceId,
      role: "user",
      content: normalizedMessage,
    });
    if (userMessageError) throw userMessageError;

    return new Response(
      buildChatStream({
        supabase,
        workspaceId: share.workspaceId,
        knowledgeBaseId: share.knowledgeBaseId,
        conversationId,
        message: normalizedMessage,
        history,
        signal: request.signal,
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      },
    );
  });
}
