"use client";

import { useRef, useState } from "react";

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

  function updateAssistant(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

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
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + data.text } : m)),
              );
              break;
            case "citations":
              updateAssistant(assistantId, { citations: data.citations });
              break;
            case "done":
              updateAssistant(assistantId, { streaming: false });
              setPhase("idle");
              break;
            case "error":
              // Functional update so this reads whatever content already
              // streamed in via prior "delta" events in *this* call, not a
              // stale closure over `messages` from when sendMessage started.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, streaming: false, content: m.content || data.message }
                    : m,
                ),
              );
              setPhase("idle");
              break;
          }
        }
      }
    } catch {
      updateAssistant(assistantId, { streaming: false });
      setPhase("idle");
    }
  }

  function abort() {
    abortRef.current?.abort();
  }

  return { messages, phase, sendMessage, abort, conversationId };
}
