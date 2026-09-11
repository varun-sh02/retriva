import { ChatPageLayout } from "@/components/chat/ChatPageLayout";
import { loadChatPageContext } from "@/lib/chat/page-context";

/** Blank composer — the "New chat" link's target. A conversation row is only
 * created once the first message is actually sent (src/app/api/chat/route.ts). */
export default async function NewKnowledgeBaseChatPage({
  params,
}: {
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const { knowledgeBase, conversations } = await loadChatPageContext(kbId);

  return (
    <ChatPageLayout knowledgeBaseId={knowledgeBase.id} conversations={conversations} />
  );
}
