import { requireDocument } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { conflict } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { detectMimeType } from "@/lib/storage/mime";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { id } = await params;
    const { workspaceId, supabase } = await requireSession();
    const document = await requireDocument(supabase, workspaceId, id);

    if (document.status !== "UPLOADING") {
      throw conflict(
        "ALREADY_CONFIRMED",
        `This document is already ${document.status.toLowerCase()}.`,
      );
    }

    const bucket = supabase.storage.from("documents");

    const { data: info, error: infoError } = await bucket.info(document.storage_path);
    if (infoError || !info) {
      throw conflict("UPLOAD_NOT_FOUND", "The uploaded file could not be found in storage.");
    }

    if (info.size !== document.size_bytes) {
      await failDocument(
        supabase,
        document.id,
        `Uploaded file size (${info.size} bytes) does not match the declared size (${document.size_bytes} bytes).`,
      );
      throw conflict("SIZE_MISMATCH", "The uploaded file's size doesn't match what was declared.");
    }

    const { data: fileBlob, error: downloadError } = await bucket.download(document.storage_path);
    if (downloadError || !fileBlob) {
      throw conflict("UPLOAD_NOT_FOUND", "The uploaded file could not be read from storage.");
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const detection = await detectMimeType(buffer, document.mime_type);

    if (!detection.ok) {
      await failDocument(supabase, document.id, detection.reason);
      throw conflict("UNSUPPORTED_MIME", "This file type isn't supported yet.");
    }

    if (detection.mimeType !== document.mime_type) {
      await failDocument(
        supabase,
        document.id,
        `Declared type "${document.mime_type}" does not match the file's real type "${detection.mimeType}".`,
      );
      throw conflict("UNSUPPORTED_MIME", "This file type isn't supported yet.");
    }

    const checksum = await sha256(buffer);

    // Relies on the documents_kb_checksum_key unique index
    // (0004_documents.sql) rather than a separate pre-check select — that
    // index is the actual race-safe source of truth; a check-then-insert
    // here would have a window between the two statements.
    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "PROCESSING", stage: "PENDING", checksum })
      .eq("id", document.id);

    if (updateError) {
      if (updateError.code === "23505") {
        throw conflict("DUPLICATE_DOCUMENT", "This file is already in this knowledge base.");
      }
      throw updateError;
    }

    return Response.json({ documentId: document.id, status: "PROCESSING", stage: "PENDING" });
  });
}

async function failDocument(
  supabase: Awaited<ReturnType<typeof requireSession>>["supabase"],
  documentId: string,
  errorMessage: string,
) {
  await supabase
    .from("documents")
    .update({ status: "FAILED", error_message: errorMessage })
    .eq("id", documentId);
}

async function sha256(buffer: Buffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(buffer));
  return Buffer.from(digest).toString("hex");
}
