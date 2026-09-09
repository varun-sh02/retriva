import { requireDocument } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { handleRoute } from "@/lib/http/handle-route";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { id } = await params;
    const { workspaceId, supabase } = await requireSession();
    const document = await requireDocument(supabase, workspaceId, id);

    return Response.json({
      documentId: document.id,
      status: document.status,
      stage: document.stage,
      errorMessage: document.error_message,
      chunkCount: document.chunk_count,
      updatedAt: document.updated_at,
    });
  });
}
