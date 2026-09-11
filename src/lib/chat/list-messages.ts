import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatCitation, ChatMessage } from "@/hooks/useChatStream";

export async function getMostRecentConversation(
  supabase: SupabaseClient,
  knowledgeBaseId: string,
): Promise<{ id: string } | null> {
  // is("visitor_id", null) is load-bearing: widget visitors' conversations
  // live in this same table, scoped to the same knowledge base. Without this
  // the owner opening their own chat would resume whichever anonymous
  // visitor happened to ask a question most recently.
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("knowledge_base_id", knowledgeBaseId)
    .is("visitor_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
};

/**
 * The owner's own conversations for a knowledge base, most recently active
 * first — backs the chat history list. is("visitor_id", null) excludes
 * widget visitors' conversations for the same reason as
 * getMostRecentConversation above.
 */
export async function listConversations(
  supabase: SupabaseClient,
  knowledgeBaseId: string,
): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("knowledge_base_id", knowledgeBaseId)
    .is("visitor_id", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}

export async function listMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, citations")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    citations: (row.citations ?? []) as ChatCitation[],
  }));
}
