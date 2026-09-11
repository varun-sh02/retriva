import { notFound } from "next/navigation";
import { ChatPageLayout } from "@/components/chat/ChatPageLayout";
import { requireConversation } from "@/lib/auth/ownership";
import { ApiError } from "@/lib/http/api-error";
import { listMessages } from "@/lib/chat/list-messages";
import { loadChatPageContext } from "@/lib/chat/page-context";

export default async function ConversationChatPage({
  params,
}: {
  params: Promise<{ kbId: string; conversationId: string }>;
}) {
  const { kbId, conversationId } = await params;
  const { workspaceId, supabase, knowledgeBase, conversations } = await loadChatPageContext(kbId);

  let conversation;
  try {
    conversation = await requireConversation(supabase, workspaceId, knowledgeBase.id, conversationId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  const initialMessages = await listMessages(supabase, conversation.id);

  return (
    <ChatPageLayout
      knowledgeBaseId={knowledgeBase.id}
      conversations={conversations}
      activeConversationId={conversation.id}
      initialMessages={initialMessages}
    />
  );
}
