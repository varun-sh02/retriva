"use client";

import type { ChatCitation } from "@/hooks/useChatStream";
import { shortCoordinate, sourceKind } from "@/lib/format/source";
import { cn } from "@/lib/utils";

/**
 * The inline citation (docs/design-system.md §5.1) — the numbered badge that
 * sits immediately after the claim it supports.
 *
 * The visual stays 16px so it reads as punctuation inside flowing text, but
 * the hit area is expanded to 44px with a centred pseudo-element. A tap
 * target inside a paragraph is exactly where an under-sized control does the
 * most damage, and shrinking the badge to fit the guidance would make the
 * text unreadable — so the two are decoupled.
 */
export function CitationBadge({
  sourceId,
  citation,
  active = false,
  onOpen,
}: {
  sourceId: string;
  /**
   * Absent while the answer is still streaming and only the retrieved set is
   * known: the badge renders in place so the text doesn't reflow when
   * citations land, but isn't clickable until it can resolve to a real chunk.
   */
  citation?: ChatCitation;
  active?: boolean;
  onOpen?: (citation: ChatCitation) => void;
}) {
  const number = sourceId.replace("SOURCE_", "");

  const className = cn(
    "relative mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand/15 px-1 align-text-top font-mono text-[0.65rem] leading-none font-medium text-brand-text tabular-nums",
    // The visual is 16px; the interactive area is 44px, centred on it and
    // pointer-only so it never covers the surrounding words for selection.
    "before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
  );

  if (!citation || !onOpen) {
    return (
      <span className={cn(className, "before:hidden")} aria-hidden="true">
        {number}
      </span>
    );
  }

  const coordinate = shortCoordinate(citation);
  const label = `Evidence ${number}: ${sourceKind(citation.contentType)} ${citation.documentName}${
    coordinate ? `, ${coordinate}` : ""
  }`;

  return (
    <button
      type="button"
      onClick={() => onOpen(citation)}
      aria-label={label}
      aria-expanded={active}
      className={cn(
        className,
        "cursor-pointer transition-colors hover:bg-brand/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "bg-brand/40",
      )}
    >
      {number}
    </button>
  );
}
