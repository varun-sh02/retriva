"use client";

import { ArrowUp, MessageCircle, Square } from "lucide-react";
import { useCallback, useState } from "react";
import type { ChatCitation } from "@/hooks/useChatStream";
import { useChatStream } from "@/hooks/useChatStream";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogoMark } from "@/components/brand/Logo";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/chat";
import { MessageList } from "./MessageList";
import { EvidenceDrawer } from "./EvidenceDrawer";

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

// target="_blank" only works here because public/widget.js's iframe sandbox
// grants allow-popups — without it this link would silently fail to open.
function PoweredByRetriva() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1 border-t py-1.5 text-center text-[11px] text-muted-foreground hover:text-foreground"
    >
      <LogoMark size={12} />
      Powered by Retriva
    </a>
  );
}

export function PublicChat({
  shareToken,
  name,
  greeting,
  description,
  avatarUrl,
  suggestedPrompts,
}: {
  shareToken: string;
  name: string;
  greeting: string | null;
  description: string | null;
  avatarUrl: string | null;
  suggestedPrompts: string[];
}) {
  const [visitorId] = useState(readVisitorId);
  // A fresh widget open (iframe (re)load) always starts on the intro card —
  // there is no restore-last-view state across loads, matching how a
  // visitor's conversation itself isn't restored across a fresh load either.
  const [view, setView] = useState<"intro" | "chat">("intro");
  const { messages, phase, sendMessage, abort } = useChatStream({
    endpoint: "/api/public/chat",
    requestFields: { shareToken, visitorId: visitorId ?? undefined },
  });
  const [input, setInput] = useState("");
  const [openCitation, setOpenCitation] = useState<ChatCitation | null>(null);
  const showCounter = input.length > MAX_MESSAGE_LENGTH * 0.8;
  const streaming = phase !== "idle" || messages[messages.length - 1]?.streaming === true;

  /**
   * A visitor has no session, so evidence is fetched through the share token
   * instead — and comes back without an asset URL. The owner shared a chat,
   * not their file library (src/app/api/public/sources/route.ts).
   */
  const loadSource = useCallback(
    (chunkId: string) =>
      fetch("/api/public/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken, chunkId }),
      }),
    [shareToken],
  );

  const activeEvidenceSet =
    messages.find((message) =>
      message.citations.some((citation) => citation.chunkId === openCitation?.chunkId),
    )?.citations ?? [];

  function ask(question: string) {
    if (!visitorId) return;
    setView("chat");
    void sendMessage(question);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // visitorId lands on the first effect tick; sending before it exists
    // would fail validation server-side.
    if (streaming || !visitorId) return;
    void sendMessage(input);
    setInput("");
  }

  if (view === "intro") {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center">
          <Avatar size="lg" className="size-20">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-lg">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div>
            <p className="text-base font-semibold">{greeting ?? name}</p>
            {description && (
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
            )}
          </div>

          {suggestedPrompts.length > 0 && (
            <div className="mt-2 flex w-full max-w-xs flex-col gap-1.5">
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  type="button"
                  // Sends the prompt rather than merely opening an empty
                  // composer — a suggested question the visitor then has to
                  // retype is not a suggestion.
                  onClick={() => ask(prompt)}
                  className="cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant={suggestedPrompts.length > 0 ? "ghost" : "default"}
            className="mt-2 gap-2"
            onClick={() => setView("chat")}
          >
            <MessageCircle className="size-4" />
            Ask your own question
          </Button>
        </div>
        <PoweredByRetriva />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b px-4 py-3">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          Answers come from this knowledge base, with the source shown.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              {greeting ?? `Ask anything about ${name}.`}
            </p>
          </div>
        ) : (
          <MessageList
            messages={messages}
            phase={phase}
            activeChunkId={openCitation?.chunkId}
            onOpenCitation={setOpenCitation}
          />
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
            aria-label="Ask a question"
            className="max-h-32 min-h-9 w-full resize-none"
          />
          {showCounter && (
            <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
              {input.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
            </p>
          )}
        </div>
        {streaming ? (
          <Button type="button" size="icon" variant="outline" onClick={abort} aria-label="Stop">
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!visitorId || input.trim().length === 0}
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
      <PoweredByRetriva />

      <EvidenceDrawer
        citation={openCitation}
        citations={activeEvidenceSet}
        onSelect={setOpenCitation}
        onClose={() => setOpenCitation(null)}
        endpoint={loadSource}
      />
    </div>
  );
}
