import "server-only";
import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { listConversations } from "./list-messages";

/** Shared by the three chat routes (base, /new, /[conversationId]). */
export async function loadChatPageContext(kbId: string) {
  const { workspaceId, supabase } = await requireSession();
  const knowledgeBase = await requireKnowledgeBase(supabase, workspaceId, kbId);
  const conversations = await listConversations(supabase, knowledgeBase.id);

  return { workspaceId, supabase, knowledgeBase, conversations };
}
