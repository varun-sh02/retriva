"use client";

import { useEffect, useMemo, useRef } from "react";
import { SearchX } from "lucide-react";
import type { ChatCitation, ChatMessage, ChatPhase } from "@/hooks/useChatStream";
import { LogoMark } from "@/components/brand/Logo";
import { INSUFFICIENT_EVIDENCE_MESSAGE } from "@/lib/chat/refusal";
import { AssistantMessage } from "./AssistantMessage";
import { EvidenceRail } from "./EvidenceRail";
import { UserMessage } from "./UserMessage";

const PHASE_LABELS: Record<Exclude<ChatPhase, "idle">, string> = {
  searching: "Searching your knowledge…",
  // "Synthesizing evidence" is our word for it, not the reader's.
  synthesizing: "Reading the evidence…",
};

/**
 * The refusal is Retriva working correctly, not an error, and is styled as a
 * considered answer rather than a failure (docs/ux-principles.md §4). Never
 * destructive colour, never muted apology text.
 */
function RefusalMessage() {
  return (
    <div className="flex max-w-[72ch] items-start gap-2.5 rounded-lg border bg-card p-3">
      <SearchX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="text-[0.9375rem] leading-[1.65]">
        <p>{INSUFFICIENT_EVIDENCE_MESSAGE}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try rephrasing, or add a source that covers it.
        </p>
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  phase,
  activeChunkId,
  onOpenCitation,
}: {
  messages: ChatMessage[];
  phase: ChatPhase;
  activeChunkId?: string | null;
  /** Omitted in the public widget, where evidence is display-only. */
  onOpenCitation?: (citation: ChatCitation) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  const streaming = lastMessage?.streaming === true;

  // Announced once, when the answer is complete. The previous implementation
  // marked the whole list aria-live, so every streamed character mutated the
  // region and a screen reader re-announced the conversation continuously
  // (docs/ux-principles.md Part IV, #1). The live region is now a single
  // status line, and the answer itself is plain content.
  const status = useMemo(() => {
    if (phase !== "idle") return PHASE_LABELS[phase];
    if (streaming) return "Writing the answer…";
    if (lastMessage?.role === "assistant" && lastMessage.content) {
      const evidence = lastMessage.citations.length;
      return `Answer complete${evidence > 0 ? `, with ${evidence} ${evidence === 1 ? "source" : "sources"}` : ""}.`;
    }
    return "";
  }, [phase, streaming, lastMessage]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {messages.map((message) => {
        if (message.role === "user") {
          return <UserMessage key={message.id} content={message.content} />;
        }

        const refused = message.content.trim() === INSUFFICIENT_EVIDENCE_MESSAGE;
        const retrievedSourceIds = message.retrievedSources
          ? new Set(message.retrievedSources.map((source) => source.sourceId))
          : undefined;

        return (
          <div
            key={message.id}
            className="flex items-start gap-2.5 duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
          >
            <LogoMark size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              {refused ? (
                <RefusalMessage />
              ) : message.content ? (
                <>
                  <AssistantMessage
                    content={message.content}
                    citations={message.citations}
                    retrievedSourceIds={retrievedSourceIds}
                    streaming={message.streaming}
                    activeChunkId={activeChunkId}
                    onOpenCitation={onOpenCitation}
                  />
                  <EvidenceRail
                    citations={message.citations}
                    retrievedSources={message.retrievedSources}
                    activeChunkId={activeChunkId}
                    onOpen={onOpenCitation}
                  />
                </>
              ) : message.streaming ? (
                <p className="text-sm text-muted-foreground" aria-hidden="true">
                  {phase !== "idle" ? PHASE_LABELS[phase] : "Thinking…"}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
