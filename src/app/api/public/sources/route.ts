import { z } from "zod";
import { resolvePublicShare } from "@/lib/auth/public-share";
import { createSupabaseServiceClient } from "@/lib/db/service";
import { badRequest, notFound } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { checkRateLimit } from "@/lib/ratelimit/check";

/**
 * The evidence panel for anonymous widget visitors.
 *
 * Same chokepoint as /api/public/chat: the visitor sends a share token, never
 * a workspace or knowledge base id, and resolvePublicShare is the only thing
 * that turns it into real ids. The chunk is then re-verified to belong to the
 * knowledge base that token resolved to — a chunk id alone is never trusted,
 * exactly as on the authenticated path (docs/api-contracts.md §5).
 *
 * It deliberately returns NO signed asset URL, which is the one way it differs
 * from GET /api/sources/:chunkId. The owner shared a chat, not their file
 * library; a visitor gets the passage the answer stood on and where it came
 * from, not a download of the original document. That is enough to verify an
 * answer and stops short of republishing the owner's source material.
 *
 * POST rather than GET because the share token is a credential and has no
 * business sitting in a URL, a referer header, or an access log.
 */
const requestSchema = z.object({
  shareToken: z.string().min(32).max(128),
  chunkId: z.uuid(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest("Invalid source request", parsed.error.flatten());
    }

    const share = await resolvePublicShare(parsed.data.shareToken);
    const supabase = createSupabaseServiceClient();

    // Generous — opening several pieces of evidence for one answer is the
    // intended behaviour — but a public unauthenticated endpoint should not
    // be an unmetered path to the owner's database (docs/security.md T7).
    await checkRateLimit(supabase, {
      workspaceId: share.workspaceId,
      bucket: `public-sources:${share.knowledgeBaseId}:minute`,
      limit: 120,
      windowMs: 60_000,
      friendlyMessage: "This chat is busy right now. Please try again in a moment.",
    });

    const { data: chunk, error: chunkError } = await supabase
      .from("chunks")
      .select(
        "id, document_id, content, content_type, page_number, start_timestamp, end_timestamp, section_path",
      )
      .eq("id", parsed.data.chunkId)
      .eq("workspace_id", share.workspaceId)
      .maybeSingle();

    if (chunkError) throw chunkError;
    if (!chunk) throw notFound("Source not found");

    // The chunk carries the workspace, but not the knowledge base — a
    // workspace can hold several, and only the one this token points at may
    // be read through it.
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, name")
      .eq("id", chunk.document_id)
      .eq("workspace_id", share.workspaceId)
      .eq("knowledge_base_id", share.knowledgeBaseId)
      .maybeSingle();

    if (documentError) throw documentError;

    if (!document) {
      return Response.json(
        {
          error: { code: "SOURCE_UNAVAILABLE", message: "This source is no longer available." },
        },
        { status: 410 },
      );
    }

    return Response.json({
      chunkId: chunk.id,
      documentId: document.id,
      documentName: document.name,
      contentType: chunk.content_type,
      content: chunk.content,
      pageNumber: chunk.page_number,
      startTimestamp: chunk.start_timestamp,
      endTimestamp: chunk.end_timestamp,
      sectionPath: chunk.section_path,
      assetUrl: null,
      assetKind: "text",
    });
  });
}
