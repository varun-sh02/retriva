"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import type { ChatMessage } from "@/hooks/useChatStream";
import { useChatStream } from "@/hooks/useChatStream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/chat";
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
    requestFields: { knowledgeBaseId },
    initialConversationId,
    initialMessages,
  });
  const [input, setInput] = useState("");

  const showCounter = input.length > MAX_MESSAGE_LENGTH * 0.8;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (phase !== "idle") return;
    void sendMessage(input);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-sm font-medium">Ask anything about this knowledge base.</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Answers are grounded in your uploaded documents.
            </p>
          </div>
        ) : (
          <MessageList messages={messages} phase={phase} />
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t p-3">
        <div className="flex-1">
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
            maxLength={MAX_MESSAGE_LENGTH}
            aria-describedby={showCounter ? "message-length" : undefined}
            className="max-h-32 min-h-9 w-full resize-none"
          />
          {/* Only near the ceiling — a counter on every short question is
              noise, but pasting a long brief should show the budget. */}
          {showCounter && (
            <p id="message-length" className="mt-1 text-right text-xs text-muted-foreground">
              {input.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={phase !== "idle" || input.trim().length === 0}
          aria-label="Send"
        >
          <ArrowUp className="size-4" />
        </Button>
      </form>

    </div>
  );
}
