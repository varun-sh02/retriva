import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { ApiError, badRequest, payloadTooLarge, unsupportedMediaType } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { contentTypeForMime, isAllowedMimeType } from "@/lib/storage/mime";
import { buildOriginalStoragePath } from "@/lib/storage/paths";
import { MAX_FILE_SIZE_BYTES, uploadUrlRequestSchema } from "@/lib/validation/document";

const MAX_CONCURRENT_PROCESSING = 10;
const MAX_DOCUMENTS_PER_KB = 100;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();

    const body = await request.json().catch(() => null);
    const parsed = uploadUrlRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest("Invalid upload request", parsed.error.flatten());
    }

    const { knowledgeBaseId, filename, mimeType, sizeBytes } = parsed.data;

    // Ownership before anything else — never build a path or touch Storage
    // for a knowledge base the caller doesn't own.
    await requireKnowledgeBase(supabase, workspaceId, knowledgeBaseId);

    if (!isAllowedMimeType(mimeType)) {
      throw unsupportedMediaType("This file type isn't supported yet.");
    }

    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw payloadTooLarge("Files must be 50 MB or smaller.");
    }

    // docs/security.md T7 — protects the shared free-tier Gemini quota
    // from one workspace, not a hard product ceiling.
    const { count: kbDocumentCount } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("knowledge_base_id", knowledgeBaseId);
    if ((kbDocumentCount ?? 0) >= MAX_DOCUMENTS_PER_KB) {
      throw new ApiError(429, "TOO_MANY_DOCUMENTS", "This knowledge base has reached its document limit.");
    }

    const { count: processingCount } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["UPLOADING", "PROCESSING"]);
    if ((processingCount ?? 0) >= MAX_CONCURRENT_PROCESSING) {
      throw new ApiError(
        429,
        "TOO_MANY_CONCURRENT_UPLOADS",
        "Too many documents are processing right now. Wait for one to finish and try again.",
      );
    }

    const documentId = crypto.randomUUID();
    const storagePath = buildOriginalStoragePath({
      workspaceId,
      knowledgeBaseId,
      documentId,
      mimeType,
    });

    const { error: insertError } = await supabase.from("documents").insert({
      id: documentId,
      knowledge_base_id: knowledgeBaseId,
      workspace_id: workspaceId,
      name: filename,
      mime_type: mimeType,
      content_type: contentTypeForMime(mimeType),
      size_bytes: sizeBytes,
      storage_path: storagePath,
      status: "UPLOADING",
    });

    if (insertError) {
      throw insertError;
    }

    // Session-bound client — the storage INSERT RLS policy
    // (supabase/migrations/0005_storage.sql) is enforced right here, not
    // just documented.
    const { data: signed, error: signError } = await supabase.storage
      .from("documents")
      .createSignedUploadUrl(storagePath);

    if (signError) {
      throw signError;
    }

    return Response.json(
      {
        documentId,
        storagePath,
        signedUrl: signed.signedUrl,
        token: signed.token,
        expiresIn: 7200,
      },
      { status: 201 },
    );
  });
}
