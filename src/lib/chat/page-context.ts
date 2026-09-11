import "server-only";
import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { listDocuments } from "@/lib/documents/list-documents";
import { listConversations } from "./list-messages";
import { suggestedQuestions } from "./suggested-questions";

/** Shared by the three chat routes (base, /new, /[conversationId]). */
export async function loadChatPageContext(kbId: string) {
  const { workspaceId, supabase } = await requireSession();
  const knowledgeBase = await requireKnowledgeBase(supabase, workspaceId, kbId);

  // Both reads are scoped to the knowledge base already verified above and
  // neither depends on the other, so they share one round trip rather than
  // two on the critical path of the app's most-visited page.
  const [conversations, documents] = await Promise.all([
    listConversations(supabase, knowledgeBase.id),
    listDocuments(supabase, knowledgeBase.id),
  ]);

  return {
    workspaceId,
    supabase,
    knowledgeBase,
    conversations,
    // Suggested questions and readiness both come from the source list, so
    // the chat can open on a state that reflects what is actually askable
    // (docs/ux-principles.md §III.4).
    suggestions: suggestedQuestions(documents),
    readyCount: documents.filter((doc) => doc.status === "READY").length,
    processingCount: documents.filter(
      (doc) => doc.status === "PROCESSING" || doc.status === "UPLOADING",
    ).length,
  };
}
