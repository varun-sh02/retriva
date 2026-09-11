"use client";

import { ArrowUp, Plus, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { ChatCitation, ChatMessage } from "@/hooks/useChatStream";
import { useChatStream } from "@/hooks/useChatStream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation/chat";
import { MessageList } from "./MessageList";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { SuggestedQuestions } from "./SuggestedQuestions";

/** Every source in this knowledge base is still being read. */
function NotReadyYet({
  knowledgeBaseId,
  processing,
}: {
  knowledgeBaseId: string;
  processing: number;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-lg font-semibold">
        {processing > 0 ? "Getting your sources ready" : "This knowledge base is empty"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {processing > 0
          ? "Retriva is reading what you added so it can answer questions about it. This usually takes a minute."
          : "Add documents, images, or recordings and Retriva will make them answerable — with every answer pointing back to where it came from."}
      </p>
      <Button
        nativeButton={false}
        render={
          <Link href={`/app/knowledge-bases/${knowledgeBaseId}/sources`}>
            <Plus className="size-4" />
            Add sources
          </Link>
        }
      />
    </div>
  );
}

export function ChatShell({
  knowledgeBaseId,
  initialConversationId,
  initialMessages,
  suggestions = [],
  readyCount,
  processingCount,
}: {
  knowledgeBaseId: string;
  initialConversationId?: string;
  initialMessages?: ChatMessage[];
  suggestions?: string[];
  readyCount: number;
  processingCount: number;
}) {
  const { messages, phase, sendMessage, abort } = useChatStream({
    requestFields: { knowledgeBaseId },
    initialConversationId,
    initialMessages,
  });
  const [input, setInput] = useState("");
  const [openCitation, setOpenCitation] = useState<ChatCitation | null>(null);

  const showCounter = input.length > MAX_MESSAGE_LENGTH * 0.8;
  const streaming = phase !== "idle" || messages[messages.length - 1]?.streaming === true;

  const loadSource = useCallback((chunkId: string) => fetch(`/api/sources/${chunkId}`), []);

  // The evidence set the panel walks is the one belonging to the answer the
  // open citation came from, so previous/next moves within that answer rather
  // than across the whole conversation.
  const activeEvidenceSet =
    messages.find((message) =>
      message.citations.some((citation) => citation.chunkId === openCitation?.chunkId),
    )?.citations ?? [];

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (streaming) return;
    void sendMessage(input);
    setInput("");
  }

  // No ready sources means every question would refuse. Pointing at Sources is
  // the honest move — offering a composer that is certain to fail is not
  // (docs/ux-principles.md §III.4).
  if (readyCount === 0 && messages.length === 0) {
    return <NotReadyYet knowledgeBaseId={knowledgeBaseId} processing={processingCount} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div>
              <h2 className="text-lg font-semibold">Ask across your sources</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Every answer points back to the exact page, frame, or moment it came from.
                {processingCount > 0 &&
                  ` ${processingCount} more ${processingCount === 1 ? "source is" : "sources are"} still being read.`}
              </p>
            </div>
            <SuggestedQuestions
              questions={suggestions}
              onSelect={(question) => void sendMessage(question)}
            />
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
              aria-label="Ask a question about this knowledge base"
              aria-describedby={showCounter ? "message-length" : undefined}
              className="max-h-32 min-h-9 w-full resize-none"
            />
            {/* Only near the ceiling — a counter on every short question is
                noise, but pasting a long brief should show the budget. */}
            {showCounter && (
              <p
                id="message-length"
                className="mt-1 text-right text-xs text-muted-foreground tabular-nums"
              >
                {input.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
              </p>
            )}
          </div>
          {streaming ? (
            <Button type="button" size="icon" variant="outline" onClick={abort} aria-label="Stop">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={input.trim().length === 0} aria-label="Send">
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </form>

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
