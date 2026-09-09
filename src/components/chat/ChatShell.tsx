"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import type { ChatCitation, ChatMessage } from "@/hooks/useChatStream";
import { useChatStream } from "@/hooks/useChatStream";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { MessageList } from "./MessageList";

export function ChatShell({
  knowledgeBaseId,
  initialConversationId,
  initialMessages,
}: {
  knowledgeBaseId: string;
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
}) {
  const { messages, phase, sendMessage } = useChatStream({
    knowledgeBaseId,
    initialConversationId,
    initialMessages,
  });
  const [input, setInput] = useState("");
  const [openCitation, setOpenCitation] = useState<ChatCitation | null>(null);
  // Off by default (docs/rag-pipeline.md §34 / TASK-068) — never affects
  // the default UI's visual density until a user opts in.
  const [showEvidence, setShowEvidence] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (phase !== "idle") return;
    void sendMessage(input);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      {messages.length > 0 && (
        <div className="flex items-center justify-end gap-2 border-b px-4 py-2">
          <Label htmlFor="show-evidence" className="text-xs text-muted-foreground">
            Show evidence
          </Label>
          <Switch id="show-evidence" checked={showEvidence} onCheckedChange={setShowEvidence} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-sm font-medium">Ask anything about this knowledge base.</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Answers are grounded in your uploaded documents, with citations you can inspect.
            </p>
          </div>
        ) : (
          <MessageList
            messages={messages}
            phase={phase}
            onOpenCitation={setOpenCitation}
            showEvidence={showEvidence}
          />
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit(event);
            }
          }}
          placeholder="Ask a question…"
          rows={1}
          className="max-h-32 min-h-9 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={phase !== "idle" || input.trim().length === 0}
          aria-label="Send"
        >
          <ArrowUp className="size-4" />
        </Button>
      </form>

      <EvidenceDrawer citation={openCitation} onClose={() => setOpenCitation(null)} />
    </div>
  );
}
