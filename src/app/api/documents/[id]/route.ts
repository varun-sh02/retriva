import { requireDocument } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { handleRoute } from "@/lib/http/handle-route";
import { deleteChunksByDocument } from "@/lib/qdrant/delete";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { id } = await params;
    const { workspaceId, supabase } = await requireSession();
    const document = await requireDocument(supabase, workspaceId, id);

    // Qdrant first, then Storage, then the Postgres row — same ordering
    // rationale as docs/data-model.md §4: if this dies partway, the worst
    // case is an orphaned row pointing at nothing (visible, repairable),
    // never a live vector or file with no owning row (invisible, unretrievable).
    await deleteChunksByDocument(workspaceId, document.id);

    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([document.storage_path]);

    if (storageError) {
      throw storageError;
    }

    // ON DELETE CASCADE on chunks.document_id removes the Postgres chunk
    // rows in the same statement.
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(null, { status: 204 });
  });
}
