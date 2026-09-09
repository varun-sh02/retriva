"use client";

import { RotateCw, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  UPLOADING: "secondary",
  PROCESSING: "default",
  READY: "default",
  FAILED: "destructive",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentRow({ document }: { document: DocumentSummary }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);

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
          toast.error(body?.error?.message ?? "Retry failed.");
          return;
        }
        const body = await response.json();
        if (body.done) {
          router.refresh();
          if (body.status === "FAILED") {
            toast.error(body.error ?? "Processing failed again.");
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
        toast.error(body?.error?.message ?? "Failed to delete document.");
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
      <li className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{document.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatSize(document.sizeBytes)}
            {document.status === "FAILED" && document.errorMessage
              ? ` · ${document.errorMessage}`
              : document.stage
                ? ` · ${document.stage.toLowerCase()}`
                : ""}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[document.status] ?? "secondary"}>{document.status}</Badge>
        {document.status === "FAILED" && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={`Retry processing ${document.name}`}
            disabled={retrying}
            onClick={handleRetry}
          >
            <RotateCw className={retrying ? "size-4 animate-spin" : "size-4"} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={`Delete ${document.name}`}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </li>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{document.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
