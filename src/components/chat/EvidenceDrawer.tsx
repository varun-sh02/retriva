"use client";

import { ChevronLeft, ChevronRight, ExternalLink, FileText, Image as ImageIcon, Play, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatCitation } from "@/hooks/useChatStream";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatTimestamp, longCoordinate, sourceKind } from "@/lib/format/source";

type SourceDetail = {
  content: string;
  assetUrl: string | null;
  assetKind: "pdf" | "image" | "video" | "text" | "none";
  pageNumber: number | null;
  startTimestamp: number | null;
  endTimestamp: number | null;
  sectionPath: string | null;
};

const KIND_ICON = { document: FileText, image: ImageIcon, recording: Video };

// Keyed by citation.chunkId in the parent, so switching citations remounts
// this rather than needing an effect to manually reset state on change.
function EvidenceDrawerContent({
  citation,
  endpoint,
}: {
  citation: ChatCitation;
  endpoint: (chunkId: string) => Promise<Response>;
}) {
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    endpoint(citation.chunkId)
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 410) {
          setUnavailable(true);
          return;
        }
        if (!response.ok) {
          setUnavailable(true);
          return;
        }
        setDetail(await response.json());
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [citation.chunkId, endpoint]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <div className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <div className="h-24 w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
    );
  }

  // The document was removed after this answer was written. The snapshotted
  // excerpt survives deliberately (citations are ON DELETE SET NULL, not
  // cascaded), so a historical answer can still show what it stood on.
  if (unavailable) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          This source was removed from the knowledge base. Here is the passage the answer was
          based on:
        </p>
        <Excerpt>{citation.excerpt}</Excerpt>
      </div>
    );
  }

  if (!detail) return null;

  const coordinate = longCoordinate(detail);

  return (
    <>
      {coordinate && (
        <p className="font-mono text-sm text-muted-foreground tabular-nums">{coordinate}</p>
      )}

      {detail.assetKind === "image" && detail.assetUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={detail.assetUrl}
          alt={`Source image: ${citation.documentName}`}
          className="max-h-80 w-full rounded-md border object-contain"
        />
      )}

      {detail.assetKind === "video" && detail.assetUrl && (
        <div className="flex flex-col gap-2">
          <video
            ref={videoRef}
            src={detail.assetUrl}
            controls
            className="w-full rounded-md border"
            onLoadedMetadata={() => {
              // The #t= URL fragment isn't honored consistently across
              // browsers for a <video> src — setting currentTime directly
              // once metadata is available is what makes "play from X"
              // reliably actually start at X, not 0:00 (TASK-055).
              if (videoRef.current && detail.startTimestamp !== null) {
                videoRef.current.currentTime = detail.startTimestamp;
              }
            }}
          />
          {detail.startTimestamp !== null && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() => {
                if (!videoRef.current) return;
                videoRef.current.currentTime = detail.startTimestamp!;
                void videoRef.current.play();
              }}
            >
              <Play className="size-3.5" />
              Play from {formatTimestamp(detail.startTimestamp)}
            </Button>
          )}
        </div>
      )}

      <Excerpt>{detail.content}</Excerpt>

      {detail.assetKind === "pdf" && detail.assetUrl && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-1.5"
          // Rendering as a real <a>, not a <button> — nativeButton must be
          // false or Base UI assumes (and warns) the render target is a
          // native button element.
          nativeButton={false}
          render={
            <a
              href={
                detail.pageNumber !== null
                  ? `${detail.assetUrl}#page=${detail.pageNumber}`
                  : detail.assetUrl
              }
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" />
              {detail.pageNumber !== null ? `Open at page ${detail.pageNumber}` : "Open document"}
            </a>
          }
        />
      )}
    </>
  );
}

/**
 * The cited passage, exactly as it appears in the source. The tint ground and
 * saffron rule are the visual thread back to the badge that opened this panel
 * (docs/design-system.md §5.4).
 */
function Excerpt({ children }: { children: string }) {
  return (
    <blockquote className="rounded-md border-l-2 border-brand bg-tint py-2 pr-3 pl-3 text-sm whitespace-pre-wrap text-tint-foreground">
      {children}
    </blockquote>
  );
}

export function EvidenceDrawer({
  citation,
  citations,
  onSelect,
  onClose,
  /**
   * How to load a passage. The owner's app reads /api/sources/:id under their
   * session; the public widget posts a share token instead, and never receives
   * an asset URL (docs/ux-principles.md §V.1).
   */
  endpoint,
}: {
  citation: ChatCitation | null;
  /** The full evidence set for the answer, so the panel can walk it. */
  citations: ChatCitation[];
  onSelect: (citation: ChatCitation) => void;
  onClose: () => void;
  endpoint: (chunkId: string) => Promise<Response>;
}) {
  const index = citation ? citations.findIndex((c) => c.chunkId === citation.chunkId) : -1;
  const previous = index > 0 ? citations[index - 1] : undefined;
  const next = index >= 0 && index < citations.length - 1 ? citations[index + 1] : undefined;
  const Icon = citation ? KIND_ICON[sourceKind(citation.contentType)] : FileText;

  return (
    <Sheet open={citation !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="gap-1">
          <div className="flex items-center gap-2 pr-8">
            <Icon className="size-4 shrink-0 text-brand-text" aria-hidden="true" />
            <SheetTitle className="truncate text-base">{citation?.documentName}</SheetTitle>
          </div>

          {index >= 0 && citations.length > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous evidence"
                disabled={!previous}
                onClick={() => previous && onSelect(previous)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {index + 1} of {citations.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next evidence"
                disabled={!next}
                onClick={() => next && onSelect(next)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          {citation && (
            <EvidenceDrawerContent key={citation.chunkId} citation={citation} endpoint={endpoint} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
