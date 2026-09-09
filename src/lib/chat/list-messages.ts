import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatCitation, ChatMessage } from "@/hooks/useChatStream";

export async function getMostRecentConversation(
  supabase: SupabaseClient,
  knowledgeBaseId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("knowledge_base_id", knowledgeBaseId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
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
