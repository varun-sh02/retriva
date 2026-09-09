import { requireSession } from "@/lib/auth/session";
import { badRequest, conflict } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { listKnowledgeBases } from "@/lib/knowledge/list-knowledge-bases";
import { createKnowledgeBaseSchema } from "@/lib/validation/knowledge-base";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();

    const body = await request.json().catch(() => null);
    const parsed = createKnowledgeBaseSchema.safeParse(body);
    if (!parsed.success) {
      throw badRequest("Invalid knowledge base payload", parsed.error.flatten());
    }

    const { data, error } = await supabase
      .from("knowledge_bases")
      .insert({
        workspace_id: workspaceId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .select("id, name, description, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw conflict("KB_NAME_TAKEN", "A knowledge base with this name already exists.");
      }
      throw error;
    }

    return Response.json(
      {
        id: data.id,
        name: data.name,
        description: data.description,
        documentCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      { status: 201 },
    );
  });
}

export async function GET() {
  return handleRoute(async () => {
    const { workspaceId, supabase } = await requireSession();
    const knowledgeBases = await listKnowledgeBases(supabase, workspaceId);

    return Response.json({
      knowledgeBases: knowledgeBases.map((kb) => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        documentCount: kb.documentCount,
        readyCount: kb.readyCount,
        processingCount: kb.processingCount,
        failedCount: kb.failedCount,
        updatedAt: kb.updatedAt,
      })),
    });
  });
}
