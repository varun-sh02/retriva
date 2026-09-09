import { ChatShell } from "@/components/chat/ChatShell";
import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { getMostRecentConversation, listMessages } from "@/lib/chat/list-messages";

export default async function KnowledgeBaseChatPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const { workspaceId, supabase } = await requireSession();
  const knowledgeBase = await requireKnowledgeBase(supabase, workspaceId, kbId);

  const conversation = await getMostRecentConversation(supabase, knowledgeBase.id);
  const initialMessages = conversation ? await listMessages(supabase, conversation.id) : [];

  return (
    <ChatShell
      knowledgeBaseId={knowledgeBase.id}
      initialConversationId={conversation?.id}
      initialMessages={initialMessages}
    />
  );
}
