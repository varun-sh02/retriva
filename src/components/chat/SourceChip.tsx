"use client";

import { FileText, Image as ImageIcon, Video } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  type SourceKind,
  shortCoordinate,
  sourceKind,
  truncateMiddle,
} from "@/lib/format/source";

const KIND_ICON: Record<SourceKind, ComponentType<{ className?: string }>> = {
  document: FileText,
  image: ImageIcon,
  recording: Video,
};

const KIND_LABEL: Record<SourceKind, string> = {
  document: "Document",
  image: "Image",
  recording: "Recording",
};

export type SourceChipData = {
  documentName: string;
  contentType: string;
  pageNumber: number | null;
  startTimestamp: number | null;
  sectionPath?: string | null;
};

/**
 * One piece of evidence, named and located. The unit of the evidence rail
 * (docs/design-system.md §5.2).
 *
 * Kind is carried by the icon alone — never by colour. The one accent belongs
 * to provenance and to the primary action, so spending it on file types would
 * destroy the signal that "saffron means this is evidence"
 * (docs/ux-principles.md §8).
 */
export function SourceChip({
  source,
  onOpen,
  active = false,
  index,
  total,
}: {
  source: SourceChipData;
  /** Omitted in the public widget, where evidence is display-only. */
  onOpen?: () => void;
  active?: boolean;
  index?: number;
  total?: number;
}) {
  const kind = sourceKind(source.contentType);
  const Icon = KIND_ICON[kind];
  const coordinate = shortCoordinate(source);

  const body = (
    <>
      <Icon className="size-3.5 shrink-0 text-brand-text" aria-hidden="true" />
      <span className="truncate">{truncateMiddle(source.documentName)}</span>
      {coordinate && (
        <span className="shrink-0 font-mono text-[0.7rem] text-brand-text tabular-nums">
          {coordinate}
        </span>
      )}
    </>
  );

  const className = cn(
    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-lg border border-brand/30 bg-tint px-2 text-xs text-tint-foreground",
    onOpen && "transition-colors hover:border-brand/60 hover:bg-brand/15",
    active && "border-brand ring-1 ring-brand/40",
  );

  if (!onOpen) {
    return <span className={className}>{body}</span>;
  }

  // The accessible name carries what the chip means, not just what it says:
  // position in the set, kind, source, and location.
  const position = index !== undefined && total !== undefined ? `Evidence ${index} of ${total}: ` : "";
  const label = `${position}${KIND_LABEL[kind]} ${source.documentName}${
    coordinate ? `, ${coordinate}` : ""
  }`;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      aria-expanded={active}
      className={cn(
        className,
        "cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      {body}
    </button>
  );
}
