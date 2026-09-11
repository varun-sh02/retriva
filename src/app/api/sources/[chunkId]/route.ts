import { requireSession } from "@/lib/auth/session";
import { notFound } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";

type RouteContext = { params: Promise<{ chunkId: string }> };

const SIGNED_URL_EXPIRY_SECONDS = 300;

/**
 * Backs the evidence drawer. Ownership is checked on the chunk, resolving
 * up through document -> KB -> workspace (docs/api-contracts.md §5) —
 * chunk_id alone is never trusted from the client.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { chunkId } = await params;
    const { workspaceId, supabase } = await requireSession();

    const { data: chunk, error: chunkError } = await supabase
      .from("chunks")
      .select(
        "id, document_id, workspace_id, content, content_type, page_number, start_timestamp, end_timestamp, section_path, metadata",
      )
      .eq("id", chunkId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (chunkError) throw chunkError;
    if (!chunk) throw notFound("Source not found");

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .select("id, name, mime_type, storage_path")
      .eq("id", chunk.document_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (documentError) throw documentError;

    // The document (and therefore the original asset) was deleted after
    // this chunk's citation was created — the chunk row itself may still
    // exist briefly via ON DELETE SET NULL elsewhere, so this is checked
    // explicitly rather than assumed impossible.
    if (!document) {
      return Response.json(
        {
          error: { code: "SOURCE_UNAVAILABLE", message: "This source is no longer available." },
        },
        { status: 410 },
      );
    }

    // A DOCX/TXT/MD chunk used to fall through to "pdf" and offer an "Open
    // document" link to a file the browser downloads rather than renders.
    // Text sources have no viewable asset — their excerpt (plus section path)
    // IS the evidence, so they get their own kind and no link.
    const assetKind =
      chunk.content_type === "image"
        ? "image"
        : chunk.content_type === "video"
          ? "video"
          : chunk.content_type === "pdf"
            ? "pdf"
            : "text";

    const { data: signed } =
      assetKind === "text"
        ? { data: null }
        : await supabase.storage
            .from("documents")
            .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRY_SECONDS);

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
      metadata: chunk.metadata ?? {},
      assetUrl: signed?.signedUrl ?? null,
      assetKind,
    });
  });
}
