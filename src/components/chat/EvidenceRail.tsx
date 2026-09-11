"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ChatCitation, RetrievedSource } from "@/hooks/useChatStream";
import { SourceChip } from "./SourceChip";

/**
 * The evidence under an answer (docs/ux-principles.md §III.2, layer 2).
 *
 * It renders from the message's stored citations, so it survives a page
 * reload (listMessages already loads them) and appears even when the model
 * wrote a well-sourced answer but forgot to place inline markers. That
 * independence from the prose is the point: evidence is part of the answer,
 * not an optional decoration on it.
 */
export function EvidenceRail({
  citations,
  retrievedSources,
  activeChunkId,
  onOpen,
}: {
  citations: ChatCitation[];
  /**
   * The passages that went into the answer, cited or not. Present only during
   * the live turn — it is never persisted (docs/ux-principles.md §V.2) — so
   * the disclosure below simply doesn't render on history.
   */
  retrievedSources?: RetrievedSource[];
  activeChunkId?: string | null;
  onOpen?: (citation: ChatCitation) => void;
}) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {citations.map((citation, index) => (
          <li key={citation.chunkId} className="min-w-0">
            <SourceChip
              source={citation}
              index={index + 1}
              total={citations.length}
              active={activeChunkId === citation.chunkId}
              onOpen={onOpen ? () => onOpen(citation) : undefined}
            />
          </li>
        ))}
      </ul>
      <RetrievalSummary citations={citations} retrievedSources={retrievedSources} />
    </div>
  );
}

/**
 * Retrieval transparency, off by default (docs/ux-principles.md §III.2).
 *
 * Deliberately says "read", not "searched": the sources event carries the
 * final context set (RAG_CONFIG.finalContextChunks), not every candidate
 * considered, and overclaiming here would undermine the one thing this
 * disclosure exists to build.
 */
function RetrievalSummary({
  citations,
  retrievedSources,
}: {
  citations: ChatCitation[];
  retrievedSources?: RetrievedSource[];
}) {
  const [open, setOpen] = useState(false);

  if (!retrievedSources || retrievedSources.length === 0) return null;

  const cited = new Set(citations.map((c) => c.sourceId));
  const uncited = retrievedSources.filter((source) => !cited.has(source.sourceId));
  const documentCount = new Set(retrievedSources.map((s) => s.documentName)).size;

  return (
    <div className="text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronDown
          className={`size-3 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        Read <span className="font-mono tabular-nums">{retrievedSources.length}</span> passages
        across <span className="font-mono tabular-nums">{documentCount}</span>{" "}
        {documentCount === 1 ? "source" : "sources"}, cited{" "}
        <span className="font-mono tabular-nums">{citations.length}</span>
      </button>

      {open && (
        <ul className="mt-1.5 flex flex-col gap-1 border-l pl-3">
          {uncited.length === 0 ? (
            <li>Every passage read was used in this answer.</li>
          ) : (
            uncited.map((source) => (
              <li key={source.sourceId} className="truncate">
                Read but not used: {source.documentName}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
