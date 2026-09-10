"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { useChatStream } from "@/hooks/useChatStream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/chat";
import { MessageList } from "./MessageList";

/**
 * Identifies a returning visitor to themselves only. It is not an identity
 * claim and grants no access on its own — the server uses it solely to stop
 * one visitor resuming another's conversation. Kept per-browser, and
 * regenerated freely if storage is unavailable, since losing it costs the
 * visitor nothing but a fresh thread.
 *
 * Read in a lazy initializer rather than an effect: localStorage is not a
 * subscription, there is nothing to synchronise, and reading it on mount and
 * then calling setState would cost an extra render on every widget open. It
 * resolves to null during SSR, which changes no rendered output — the send
 * button is already disabled on an empty input — so hydration still matches.
 */
const VISITOR_ID_KEY = "retriva:visitor-id";

function readVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
  } catch {
    // Private mode or blocked storage — fall through to a session-only id.
  }
  const id = crypto.randomUUID();
  try {
    window.localStorage.setItem(VISITOR_ID_KEY, id);
  } catch {
    // Not fatal: the id still works for this page's lifetime.
  }
  return id;
}

export function PublicChat({
  shareToken,
  name,
  greeting,
}: {
  shareToken: string;
  name: string;
  greeting: string | null;
}) {
  const [visitorId] = useState(readVisitorId);
  const { messages, phase, sendMessage } = useChatStream({
    endpoint: "/api/public/chat",
    requestFields: { shareToken, visitorId: visitorId ?? undefined },
  });
  const [input, setInput] = useState("");
  const showCounter = input.length > MAX_MESSAGE_LENGTH * 0.8;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // visitorId lands on the first effect tick; sending before it exists
    // would fail validation server-side.
    if (phase !== "idle" || !visitorId) return;
    void sendMessage(input);
    setInput("");
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b px-4 py-3">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">Answers come from this knowledge base.</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {greeting ?? `Ask anything about ${name}.`}
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
            className="max-h-32 min-h-9 w-full resize-none"
          />
          {showCounter && (
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {input.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={phase !== "idle" || !visitorId || input.trim().length === 0}
          aria-label="Send"
        >
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </div>
  );
}
