import { ChatPageLayout } from "@/components/chat/ChatPageLayout";
import { getMostRecentConversation, listMessages } from "@/lib/chat/list-messages";
import { loadChatPageContext } from "@/lib/chat/page-context";

export default async function KnowledgeBaseChatPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const { supabase, knowledgeBase, conversations } = await loadChatPageContext(kbId);

  const conversation = await getMostRecentConversation(supabase, knowledgeBase.id);
  const initialMessages = conversation ? await listMessages(supabase, conversation.id) : [];

  return (
    <ChatPageLayout
      knowledgeBaseId={knowledgeBase.id}
      conversations={conversations}
      activeConversationId={conversation?.id}
      initialMessages={initialMessages}
    />
  );
}
