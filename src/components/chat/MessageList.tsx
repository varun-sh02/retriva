"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, ChatPhase } from "@/hooks/useChatStream";
import { LogoMark } from "@/components/brand/Logo";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";

const PHASE_LABELS: Record<Exclude<ChatPhase, "idle">, string> = {
  searching: "Searching your knowledge…",
  synthesizing: "Synthesizing evidence…",
};

export function MessageList({
  messages,
  phase,
}: {
  messages: ChatMessage[];
  phase: ChatPhase;
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
            className="flex max-w-[85%] items-start gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            <LogoMark size={20} className="mt-0.5 shrink-0" />
            {message.content ? (
              <AssistantMessage content={message.content} />
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
