"use client";

import { useEffect, useRef } from "react";
import type { ChatCitation, ChatMessage, ChatPhase } from "@/hooks/useChatStream";
import { AssistantMessage } from "./AssistantMessage";
import { RetrievalTransparency } from "./RetrievalTransparency";
import { UserMessage } from "./UserMessage";

const PHASE_LABELS: Record<Exclude<ChatPhase, "idle">, string> = {
  searching: "Searching your knowledge…",
  synthesizing: "Synthesizing evidence…",
};

export function MessageList({
  messages,
  phase,
  onOpenCitation,
  showEvidence = false,
}: {
  messages: ChatMessage[];
  phase: ChatPhase;
  onOpenCitation: (citation: ChatCitation) => void;
  /** Off by default (docs/rag-pipeline.md §34) — never affects default visual density. */
  showEvidence?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 p-4" aria-live="polite">
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} content={message.content} />
        ) : (
          <div
            key={message.id}
            className="max-w-[85%] animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            {message.content ? (
              <>
                <AssistantMessage
                  content={message.content}
                  citations={message.citations}
                  onOpenCitation={onOpenCitation}
                />
                {showEvidence && message.retrievedSources && (
                  <RetrievalTransparency sources={message.retrievedSources} />
                )}
              </>
            ) : message.streaming ? (
              <p className="text-sm text-muted-foreground">
                {phase !== "idle" ? PHASE_LABELS[phase] : "Thinking…"}
              </p>
            ) : null}
          </div>
        ),
      )}
      <div ref={bottomRef} />
    </div>
  );
}
