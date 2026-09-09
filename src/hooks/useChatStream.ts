"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatCitation = {
  sourceId: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  contentType: string;
  excerpt: string;
  pageNumber: number | null;
  startTimestamp: number | null;
  endTimestamp: number | null;
  sectionPath: string | null;
  score: number;
};

export type RetrievedSource = {
  sourceId: string;
  documentName: string;
  contentType: string;
  pageNumber: number | null;
  startTimestamp: number | null;
  endTimestamp: number | null;
  score: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  retrievedSources?: RetrievedSource[];
  streaming?: boolean;
};

export type ChatPhase = "idle" | "searching" | "synthesizing";

/**
 * Consumes the /api/chat SSE stream (docs/api-contracts.md §4). Deltas are
 * plain string concatenation, so a marker like `[SOURCE_1]` split across two
 * chunks reassembles correctly with no special handling — the parsing here
 * only needs to handle SSE *frame* boundaries not aligning with read()
 * chunk boundaries, which the buffer-and-keep-remainder logic below covers.
 */
export function useChatStream(params: {
  knowledgeBaseId: string;
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
}) {
  const [conversationId, setConversationId] = useState(params.initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(params.initialMessages ?? []);
  const [phase, setPhase] = useState<ChatPhase>("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Gemini does not emit a smooth character stream. Measured on a real turn:
  // 17 chunks averaging 104 chars, the first six of them landing within 5ms
  // of each other — a third of the answer appears in one frame, then the rest
  // arrives in ~100-char steps. Appending each chunk straight to state renders
  // that as a few big jumps, which reads as "the whole response arrived at
  // once" rather than as streaming. These refs hold text that has arrived but
  // has not been shown yet; a frame loop releases it at a steady rate.
  const pendingRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const finalizeRef = useRef<(() => void) | null>(null);
  const activeAssistantRef = useRef<string | null>(null);

  function updateAssistant(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  const drain = useCallback(() => {
    if (rafRef.current !== null) return;

    const step = () => {
      const assistantId = activeAssistantRef.current;
      const pending = pendingRef.current;

      if (assistantId && pending.length > 0) {
        // Release a slice proportional to the backlog: a large burst catches
        // up within a few frames, while a trickle still reads as typing. A
        // fixed rate would either lag behind fast answers or crawl on slow
        // ones.
        const take = Math.max(2, Math.ceil(pending.length / 6));
        const slice = pending.slice(0, take);
        pendingRef.current = pending.slice(take);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + slice } : m)),
        );
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      rafRef.current = null;
      // Finalization — citations, streaming: false, phase back to idle — waits
      // for the buffer to empty, so a message is never marked complete while
      // its text is still appearing.
      const finalize = finalizeRef.current;
      finalizeRef.current = null;
      finalize?.();
    };

    rafRef.current = requestAnimationFrame(step);
  }, []);

  // requestAnimationFrame does not fire in a background tab. Without this the
  // drain would stall mid-answer and `phase` would never return to idle,
  // blocking the next question until the tab regained focus.
  const flush = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const assistantId = activeAssistantRef.current;
    const rest = pendingRef.current;
    pendingRef.current = "";
    if (assistantId && rest) {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + rest } : m)),
      );
    }
    const finalize = finalizeRef.current;
    finalizeRef.current = null;
    finalize?.();
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) flush();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [flush]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0 || phase !== "idle") return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      citations: [],
    };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", citations: [], streaming: true },
    ]);
    setPhase("searching");

    pendingRef.current = "";
    finalizeRef.current = null;
    activeAssistantRef.current = assistantId;
    let streamedCitations: ChatCitation[] = [];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseId: params.knowledgeBaseId, conversationId, message: trimmed }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        flush();
        updateAssistant(assistantId, {
          streaming: false,
          content: body?.error?.message ?? "Something went wrong.",
        });
        setPhase("idle");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim()) continue;
          const eventMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);
          const event = eventMatch?.[1];
          const dataLine = dataMatch?.[1];
          if (!event || !dataLine) continue;

          const data = JSON.parse(dataLine);

          switch (event) {
            case "meta":
              setConversationId(data.conversationId);
              break;
            case "status":
              setPhase(data.phase);
              break;
            case "sources":
              updateAssistant(assistantId, { retrievedSources: data.sources });
              break;
            case "delta":
              pendingRef.current += data.text;
              drain();
              break;
            case "citations":
              // Held until the drain finishes rather than applied on arrival:
              // citations land before the last deltas have been rendered.
              streamedCitations = data.citations;
              break;
            case "done":
              finalizeRef.current = () => {
                updateAssistant(assistantId, { streaming: false, citations: streamedCitations });
                setPhase("idle");
              };
              drain();
              break;
            case "error":
              // Functional update so this reads whatever content already
              // streamed in via prior "delta" events in *this* call, not a
              // stale closure over `messages` from when sendMessage started.
              finalizeRef.current = () => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, streaming: false, content: m.content || data.message }
                      : m,
                  ),
                );
                setPhase("idle");
              };
              drain();
              break;
          }
        }
      }
    } catch {
      flush();
      updateAssistant(assistantId, { streaming: false });
      setPhase("idle");
    }
  }

  function abort() {
    abortRef.current?.abort();
    flush();
  }

  return { messages, phase, sendMessage, abort, conversationId };
}
