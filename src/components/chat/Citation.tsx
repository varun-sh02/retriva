"use client";

import type { ChatCitation } from "@/hooks/useChatStream";

export function CitationBadge({
  sourceId,
  citation,
  onOpen,
}: {
  sourceId: string;
  citation?: ChatCitation;
  onOpen: (citation: ChatCitation) => void;
}) {
  if (!citation) {
    // Model referenced a source label the server didn't issue this turn —
    // should already be stripped upstream (docs/chat/citations.ts), but a
    // bare unclickable marker is a safe fallback rather than crashing.
    return <span className="text-xs text-muted-foreground">[{sourceId}]</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(citation)}
      className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[0.65rem] font-medium text-primary align-text-top hover:bg-primary/20"
    >
      {sourceId.replace("SOURCE_", "")}
    </button>
  );
}
