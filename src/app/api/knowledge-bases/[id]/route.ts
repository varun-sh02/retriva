import { requireKnowledgeBase } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { badRequest, conflict } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { getKnowledgeBaseCounts } from "@/lib/knowledge/list-knowledge-bases";
import { deleteChunksByKnowledgeBase } from "@/lib/qdrant/delete";
import { updateKnowledgeBaseSchema } from "@/lib/validation/knowledge-base";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { id } = await params;
    const { workspaceId, supabase } = await requireSession();
    const kb = await requireKnowledgeBase(supabase, workspaceId, id);
    const counts = await getKnowledgeBaseCounts(supabase, kb.id);

    return Response.json({
      id: kb.id,
      name: kb.name,
      description: kb.description,
      ...counts,
      updatedAt: kb.updated_at,
    });
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { id } = await params;
    const { workspaceId, supabase } = await requireSession();
    await requireKnowledgeBase(supabase, workspaceId, id);

    const body = await request.json().catch(() => null);
    const parsed = updateKnowledgeBaseSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest("Invalid update payload", parsed.error.flatten());
    }

    const { data, error } = await supabase
      .from("knowledge_bases")
      .update(parsed.data)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("id, name, description, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw conflict("KB_NAME_TAKEN", "A knowledge base with this name already exists.");
      }
      throw error;
    }

    return Response.json({
      id: data.id,
      name: data.name,
      description: data.description,
      updatedAt: data.updated_at,
    });
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { id } = await params;
    const { workspaceId, supabase } = await requireSession();
    await requireKnowledgeBase(supabase, workspaceId, id);

    const { data: documents, error: listError } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("knowledge_base_id", id);
    if (listError) throw listError;

    // Qdrant first, then Storage, then the Postgres row — same ordering as
    // the single-document DELETE route and docs/data-model.md §4.
    await deleteChunksByKnowledgeBase(workspaceId, id);

    if (documents && documents.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove(documents.map((d) => d.storage_path));
      if (storageError) throw storageError;
    }

    // ON DELETE CASCADE removes documents, chunks, conversations, messages,
    // citations, retrieval_logs in the same statement.
    const { error } = await supabase
      .from("knowledge_bases")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      throw error;
    }

    return new Response(null, { status: 204 });
  });
}
