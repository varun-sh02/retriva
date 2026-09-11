import { ChatPageLayout } from "@/components/chat/ChatPageLayout";
import { getMostRecentConversation, listMessages } from "@/lib/chat/list-messages";
import { loadChatPageContext } from "@/lib/chat/page-context";

/**
 * A knowledge base opens on Ask, not on file management — asking is the
 * product's purpose and the reason the user came back (docs/ux-principles.md
 * Part II). A knowledge base with no ready sources renders the empty state
 * inside ChatShell, which points at Sources, so a first-time user is still
 * routed correctly.
 */
export default async function KnowledgeBaseAskPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const { supabase, knowledgeBase, conversations, suggestions, readyCount, processingCount } =
    await loadChatPageContext(kbId);

  const conversation = await getMostRecentConversation(supabase, knowledgeBase.id);
  const initialMessages = conversation ? await listMessages(supabase, conversation.id) : [];

  return (
    <ChatPageLayout
      knowledgeBaseId={knowledgeBase.id}
      conversations={conversations}
      activeConversationId={conversation?.id}
      initialMessages={initialMessages}
      suggestions={suggestions}
      readyCount={readyCount}
      processingCount={processingCount}
    />
  );
}
