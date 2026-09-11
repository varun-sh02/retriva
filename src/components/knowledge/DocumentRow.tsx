"use client";

import { ChevronDown, FileText, Image as ImageIcon, MoreHorizontal, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { DocumentSummary } from "@/lib/documents/list-documents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sourceKind } from "@/lib/format/source";

const KIND_ICON = { document: FileText, image: ImageIcon, recording: Video };

/**
 * Real pipeline stages mapped to one human phrase each
 * (docs/product-language.md §2). The modality-specific "Reading" copy is not
 * decoration — the server genuinely renders PDF pages through vision, and
 * genuinely transcribes video — so saying which one is happening is accurate,
 * and reads as the product knowing what it is doing.
 */
function stageLabel(stage: string | null, contentType: string): string {
  if (stage === "CHUNKING") return "Organizing";
  if (stage === "EMBEDDING" || stage === "INDEXING") return "Making searchable";
  if (stage === "PENDING" || stage === "EXTRACTING" || stage === null) {
    if (contentType === "video") return "Listening to recording";
    if (contentType === "image") return "Looking at image";
    if (contentType === "pdf") return "Reading pages";
    return "Reading document";
  }
  return "Processing";
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentRow({ document }: { document: DocumentSummary }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const Icon = KIND_ICON[sourceKind(document.contentType)];
  const processing = document.status === "PROCESSING" || document.status === "UPLOADING";
  const failed = document.status === "FAILED";

  // Resumes a document left mid-pipeline — e.g. the tab that uploaded it
  // was closed before processing finished (docs/technical-decisions.md
  // ADR-007: processing stops if the tab closes; resuming here is the
  // documented mitigation). UploadDropzone drives its own in-progress
  // uploads directly, so this only ever needs to pick up an already
  // PROCESSING document on a fresh page load.
  useEffect(() => {
    if (document.status !== "PROCESSING") return;

    let cancelled = false;

    async function resume() {
      for (let i = 0; i < 200; i++) {
        if (cancelled) return;
        const response = await fetch(`/api/documents/${document.id}/process`, { method: "POST" });
        if (!response.ok) return;
        const body = await response.json();
        if (body.done) {
          if (!cancelled) router.refresh();
          return;
        }
      }
    }

    void resume();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id, document.status]);

  async function handleRetry() {
    setRetrying(true);
    try {
      for (let i = 0; i < 200; i++) {
        const response = await fetch(`/api/documents/${document.id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(i === 0 ? { force: true } : {}),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          toast.error(body?.error?.message ?? "We couldn't start reading this file again.");
          return;
        }
        const body = await response.json();
        if (body.done) {
          router.refresh();
          if (body.status === "FAILED") {
            toast.error("We still couldn't finish reading this file.");
          }
          return;
        }
      }
    } finally {
      setRetrying(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.error?.message ?? "We couldn't remove this source.");
        return;
      }
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <li className="group flex flex-col gap-1 border-b px-4 py-3 last:border-b-0">
        <div className="flex items-center gap-3">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{document.name}</p>
            <p
              className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
              // Announces the transition to ready or failed, which was
              // previously silent (docs/ux-principles.md Part IV, #7).
              aria-live="polite"
            >
              <span>{formatSize(document.sizeBytes)}</span>
              <span aria-hidden="true">·</span>
              {processing ? (
                <>
                  <span
                    className="size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <span>{stageLabel(document.stage, document.contentType)}…</span>
                </>
              ) : failed ? (
                <span className="text-destructive">Couldn&apos;t process</span>
              ) : (
                <span>
                  Ready
                  {document.chunkCount > 0 && ` · ${document.chunkCount} passages`}
                </span>
              )}
            </p>
          </div>

          {failed && (
            <Button variant="outline" size="sm" disabled={retrying} onClick={handleRetry}>
              {retrying ? "Trying…" : "Try again"}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  // focus-visible is mandatory alongside group-hover: without
                  // it a keyboard user focuses a control they cannot see
                  // (docs/ux-principles.md Part IV, #2).
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                  aria-label={`Actions for ${document.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* What happened, what is still true, what to do — with the technical
            reason behind a disclosure rather than in the headline
            (docs/ux-principles.md §III.6). */}
        {failed && (
          <div className="ml-7 flex flex-col gap-1 text-xs">
            <p className="text-muted-foreground">
              Your original file is safe and still stored. You can try again.
            </p>
            {document.errorMessage && (
              <>
                <button
                  type="button"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                  aria-expanded={detailsOpen}
                  className="inline-flex w-fit cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ChevronDown
                    className={`size-3 transition-transform motion-reduce:transition-none ${detailsOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                  Show details
                </button>
                {detailsOpen && (
                  <p className="border-l pl-2 font-mono text-muted-foreground">
                    {document.errorMessage}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </li>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{document.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Retriva will stop answering from this source. Answers that already cited it keep the
              passage they were based on. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
