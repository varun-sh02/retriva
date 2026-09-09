"use client";

import type { RetrievedSource } from "@/hooks/useChatStream";

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatLocation(source: RetrievedSource): string | null {
  if (source.pageNumber !== null) return `p.${source.pageNumber}`;
  if (source.startTimestamp !== null) return formatTimestamp(source.startTimestamp);
  return null;
}

/**
 * Off-by-default (docs/rag-pipeline.md §34 / TASK-068) — rendered only when
 * the caller's "Show evidence" toggle is on, so it never affects the
 * default UI's visual density. Shows the FULL retrieved set with
 * similarity scores, not just what the model ended up citing.
 */
export function RetrievalTransparency({ sources }: { sources: RetrievedSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
      <span className="font-medium">Retrieved evidence</span>
      <ol className="flex flex-col gap-0.5">
        {sources.map((source, index) => {
          const location = formatLocation(source);
          return (
            <li key={source.sourceId} className="flex items-center gap-1.5">
              <span className="tabular-nums">{index + 1}.</span>
              <span className="truncate">{source.documentName}</span>
              {location && <span>· {location}</span>}
              <span className="ml-auto tabular-nums">similarity {source.score.toFixed(2)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
