import type { ChatMessage } from "@/hooks/useChatStream";
import type { ConversationSummary } from "@/lib/chat/list-messages";
import { ChatShell } from "./ChatShell";
import { ConversationSidebar } from "./ConversationSidebar";

export function ChatPageLayout({
  knowledgeBaseId,
  conversations,
  activeConversationId,
  initialMessages,
}: {
  knowledgeBaseId: string;
  conversations: ConversationSummary[];
  activeConversationId?: string;
  initialMessages?: ChatMessage[];
}) {
  return (
    <div className="relative flex h-full">
      <ConversationSidebar
        knowledgeBaseId={knowledgeBaseId}
        conversations={conversations}
        activeConversationId={activeConversationId}
      />
      <div className="min-w-0 flex-1">
        <ChatShell
          // Remounts on conversation switch so useChatStream's internal
          // state (messages, conversationId, stream buffers) doesn't carry
          // over from whatever conversation was open before.
          key={activeConversationId ?? "new"}
          knowledgeBaseId={knowledgeBaseId}
          initialConversationId={activeConversationId}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}
