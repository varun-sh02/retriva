"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

type FileUploadState = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "confirming" | "processing" | "done" | "error";
  stage?: string | null;
  errorMessage?: string;
};

// Browsers don't always populate File.type for these extensions.
const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
};

// Contextual copy tied to the real stage (docs/rag-pipeline.md §25, and the
// canonical mapping in docs/product-language.md §2) rather than a generic
// "Processing…" spinner. "Indexing knowledge" was replaced: `index` is one of
// the machine words banned from the interface.
const STAGE_LABELS: Record<string, string> = {
  PENDING: "Reading…",
  EXTRACTING: "Reading…",
  CHUNKING: "Organizing…",
  EMBEDDING: "Making searchable…",
  INDEXING: "Making searchable…",
};

function stageLabel(stage?: string | null): string {
  return (stage && STAGE_LABELS[stage]) || "Reading…";
}

function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (extension && EXTENSION_MIME_FALLBACK[extension]) || "";
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function UploadDropzone({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<FileUploadState[]>([]);

  async function uploadFile(file: File) {
    const id = crypto.randomUUID();
    const mimeType = resolveMimeType(file);

    setUploads((prev) => [...prev, { id, name: file.name, progress: 0, status: "uploading" }]);

    function update(patch: Partial<FileUploadState>) {
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    }

    try {
      const urlResponse = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeBaseId,
          filename: file.name,
          mimeType,
          sizeBytes: file.size,
        }),
      });
      const urlBody = await urlResponse.json();

      if (!urlResponse.ok) {
        update({ status: "error", errorMessage: urlBody.error?.message });
        toast.error(urlBody.error?.message ?? "Upload failed.");
        return;
      }

      await putWithProgress(urlBody.signedUrl, file, mimeType, (fraction) =>
        update({ progress: fraction }),
      );

      update({ status: "confirming", progress: 1 });

      const confirmResponse = await fetch(`/api/documents/${urlBody.documentId}/confirm`, {
        method: "POST",
      });
      const confirmBody = await confirmResponse.json();

      if (!confirmResponse.ok) {
        update({ status: "error", errorMessage: confirmBody.error?.message });
        toast.error(confirmBody.error?.message ?? "We couldn't read this file.");
        return;
      }

      update({ status: "processing" });
      router.refresh();

      await driveProcessing(urlBody.documentId, update);
      router.refresh();
    } catch {
      update({ status: "error", errorMessage: "Upload failed." });
      toast.error("We couldn't upload this file. Check your connection and try again.");
    }
  }

  async function driveProcessing(
    documentId: string,
    update: (patch: Partial<FileUploadState>) => void,
  ) {
    // Advances the server-side state machine one stage per call
    // (docs/architecture.md §6) until it reports done — this loop is what
    // actually turns a confirmed upload into a READY, searchable document.
    for (let i = 0; i < 200; i++) {
      const response = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      const body = await response.json();

      if (!response.ok) {
        update({ status: "error", errorMessage: body.error?.message });
        toast.error(body.error?.message ?? "We couldn't finish reading this file.");
        return;
      }

      update({ stage: body.stage });

      if (body.done) {
        if (body.status === "FAILED") {
          update({ status: "error", errorMessage: body.error ?? "We couldn't finish reading this file." });
          toast.error("We couldn't finish reading this file. Your original file is safe — try again from the list below.");
        } else {
          update({ status: "done" });
        }
        return;
      }
    }

    update({ status: "error", errorMessage: "This is taking longer than expected. Your file is safe — try again from the list below." });
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      void uploadFile(file);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Add sources"
        aria-describedby="dropzone-formats"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            // Space on a custom role="button" scrolls the page unless the
            // default is suppressed (docs/ux-principles.md Part IV, #6).
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
          dragOver ? "border-brand bg-tint" : "border-border"
        }`}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">Drop files here, or click to browse</p>
        <p id="dropzone-formats" className="text-xs text-muted-foreground">
          Documents, images, and recordings — PDF, DOCX, TXT, Markdown, PNG, JPEG, MP4
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="flex flex-col gap-2">
          {uploads.map((upload) => (
            <li key={upload.id} className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="truncate">{upload.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {upload.status === "uploading" && `${Math.round(upload.progress * 100)}%`}
                  {upload.status === "confirming" && "Checking file…"}
                  {upload.status === "processing" && stageLabel(upload.stage)}
                  {upload.status === "done" && "Ready"}
                  {upload.status === "error" && "Couldn't process"}
                </span>
              </div>
              {(upload.status === "uploading" ||
                upload.status === "confirming" ||
                upload.status === "processing") && (
                <Progress value={upload.status === "uploading" ? upload.progress * 100 : null} />
              )}
              {upload.status === "error" && upload.errorMessage && (
                <p className="text-xs text-destructive">{upload.errorMessage}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
