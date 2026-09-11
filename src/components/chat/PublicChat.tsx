"use client";

import { ArrowUp, MessageCircle, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
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

/**
 * Whether this page is running inside the widget iframe rather than being
 * opened directly.
 *
 * useSyncExternalStore, not an effect: the value is read from outside React,
 * differs between the server snapshot and the client, and never changes
 * afterwards — hence the no-op subscribe. An effect writing state here would
 * be a cascading render for a constant.
 */
const NEVER_CHANGES = () => () => {};

function useIsEmbedded(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => window.self !== window.top,
    () => false,
  );
}

/**
 * Asks the host page's widget loader to close the panel.
 *
 * The iframe cannot close itself — only public/widget.js can hide it — so the
 * close control has to cross the frame boundary. targetOrigin is "*" because
 * the embedder's origin is unknown by design (any site may embed), which is
 * safe here only because the message carries no data: it is a bare signal,
 * and widget.js verifies the sender's origin before acting on it.
 */
function requestClose() {
  try {
    window.parent.postMessage({ type: "retriva:close" }, "*");
  } catch {
    // A parent that refuses the message leaves the panel open — the host
    // page's own launcher is still there on desktop.
  }
}

function CloseButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Close chat"
      className={className}
      onClick={requestClose}
    >
      <X className="size-4" />
    </Button>
  );
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const embedded = useIsEmbedded();
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

  // Moving to chat hands focus to the composer, so a prefilled prompt can be
  // sent or edited without reaching for the mouse first.
  useEffect(() => {
    if (view === "chat") composerRef.current?.focus();
  }, [view]);

  // Escape is handled here as well as in widget.js: once focus is inside the
  // iframe the host page never sees the keystroke, so the loader's own
  // listener cannot fire.
  useEffect(() => {
    if (!embedded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [embedded]);

  /**
   * A quick action opens the chat with the question ready to send — it does
   * not send it. Firing a request on a single tap commits the visitor to a
   * question they may only have been reading, and gives them nothing to edit.
   */
  function ask(question: string) {
    setInput(question);
    setView("chat");
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
      <div className="relative flex h-dvh flex-col bg-background">
        {embedded && <CloseButton className="absolute top-2 right-2 z-10" />}

        {/*
          m-auto on the child rather than items-center on the parent: with a
          scrolling flex container, align-items:center clips the TOP of content
          taller than the box and makes it unreachable, while auto margins
          collapse correctly and stay scrollable. That case is real here — a
          long greeting plus four prompts overflows a 600px widget frame.
        */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-8">
          <div className="m-auto flex w-full max-w-md flex-col gap-6 sm:max-w-lg sm:rounded-2xl sm:border sm:bg-card sm:p-10">
            {/* Identity reads centred; everything actionable below shares one
                left edge, so the card has a single alignment rather than four. */}
            <div className="flex flex-col items-center gap-3 text-center">
              <Avatar size="lg" className="size-14 sm:size-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="text-lg">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-1.5">
                <h1 className="text-base leading-snug font-semibold text-balance sm:text-lg">
                  {greeting ?? name}
                </h1>
                {description && (
                  <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {suggestedPrompts.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => ask(prompt)}
                        className="w-full cursor-pointer rounded-lg border px-3.5 py-2.5 text-left text-sm leading-snug transition-colors hover:border-foreground/20 hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Full width, matching the prompts above it — a centred pill
                  under a stack of full-width rows is what made this column
                  read as unaligned. */}
              <Button
                type="button"
                variant={suggestedPrompts.length > 0 ? "ghost" : "default"}
                className="h-10 w-full justify-center gap-2"
                onClick={() => setView("chat")}
              >
                <MessageCircle className="size-4" />
                Ask your own question
              </Button>
            </div>
          </div>
        </div>
        <PoweredByRetriva />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5">
          <Avatar className="size-7 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-xs">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              Answers come from this knowledge base, with the source shown.
            </p>
          </div>
          {embedded && <CloseButton />}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="max-w-sm text-sm text-muted-foreground sm:text-base">
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

      <form onSubmit={handleSubmit} className="border-t p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="flex-1">
            <Textarea
              ref={composerRef}
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
        </div>
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
