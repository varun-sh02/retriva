"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatCitation } from "@/hooks/useChatStream";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type SourceDetail = {
  content: string;
  assetUrl: string | null;
  assetKind: "pdf" | "image" | "video" | "none";
  pageNumber: number | null;
  startTimestamp: number | null;
  endTimestamp: number | null;
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Keyed by citation.chunkId in the parent, so switching citations remounts
// this rather than needing an effect to manually reset state on change.
function EvidenceDrawerContent({ citation }: { citation: ChatCitation }) {
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sources/${citation.chunkId}`)
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 410) {
          setUnavailable(true);
          return;
        }
        setDetail(await response.json());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [citation.chunkId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (unavailable) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          This source is no longer available. Here is the excerpt this answer was based on:
        </p>
        <blockquote className="rounded-md border-l-2 border-brand bg-tint py-2 pl-3 text-sm text-tint-foreground italic">
          {citation.excerpt}
        </blockquote>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <>
      {detail.pageNumber !== null && (
        <p className="text-sm text-muted-foreground">
          Page <span className="font-mono">{detail.pageNumber}</span>
        </p>
      )}
      {detail.startTimestamp !== null && detail.endTimestamp !== null && (
        <p className="font-mono text-sm text-muted-foreground">
          {formatTimestamp(detail.startTimestamp)}–{formatTimestamp(detail.endTimestamp)}
        </p>
      )}

      {detail.assetKind === "image" && detail.assetUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={detail.assetUrl}
          alt={citation.documentName}
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

      <blockquote className="rounded-md border-l-2 border-brand bg-tint py-2 pl-3 text-sm whitespace-pre-wrap text-tint-foreground">
        {detail.content}
      </blockquote>

      {detail.assetKind === "pdf" && detail.assetUrl && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          // Rendering as a real <a>, not a <button> — nativeButton must be
          // false or Base UI assumes (and warns) the render target is a
          // native button element.
          nativeButton={false}
          render={
            <a
              href={
                detail.pageNumber !== null ? `${detail.assetUrl}#page=${detail.pageNumber}` : detail.assetUrl
              }
              target="_blank"
              rel="noreferrer"
            >
              Open document
            </a>
          }
        />
      )}
    </>
  );
}

export function EvidenceDrawer({
  citation,
  onClose,
}: {
  citation: ChatCitation | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={citation !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="truncate">{citation?.documentName}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          {citation && <EvidenceDrawerContent key={citation.chunkId} citation={citation} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
