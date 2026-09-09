import { requireDocument } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/session";
import { conflict } from "@/lib/http/api-error";
import { handleRoute } from "@/lib/http/handle-route";
import { advanceProcessing } from "@/lib/ingestion/state-machine";
import { deleteChunksByDocument } from "@/lib/qdrant/delete";

// Vercel Hobby fluid-compute ceiling (docs/architecture.md §6) — the state
// machine is designed to complete one bounded unit of work well within this.
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  return handleRoute(async () => {
    const { id } = await params;
    const { workspaceId, supabase } = await requireSession();
    const document = await requireDocument(supabase, workspaceId, id);

    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    if (document.status === "READY" || document.status === "FAILED") {
      if (!force) {
        return Response.json({
          documentId: id,
          status: document.status,
          stage: document.stage,
          progress: { current: document.chunk_count, total: document.chunk_count, unit: "chunks" },
          done: true,
        });
      }

      // Reprocessing: any vectors from a previous attempt are removed
      // *before* resetting to PENDING. CHUNKING's delete-then-insert
      // generates fresh chunk UUIDs, so old Qdrant points would otherwise
      // be orphaned — this is what keeps reprocessing idempotent rather
      // than accumulating stale vectors (docs/data-model.md §3).
      await deleteChunksByDocument(workspaceId, id);

      const { error: resetError } = await supabase
        .from("documents")
        .update({
          status: "PROCESSING",
          stage: "PENDING",
          stage_cursor: {},
          error_message: null,
          chunk_count: 0,
          processing_lock: null,
        })
        .eq("id", id)
        .eq("workspace_id", workspaceId);
      if (resetError) throw resetError;
    }

    try {
      const outcome = await advanceProcessing(supabase, workspaceId, id);
      return Response.json({ documentId: id, ...outcome });
    } catch (error) {
      if (error instanceof Error && error.name === "AlreadyProcessingError") {
        throw conflict("ALREADY_PROCESSING", "This document is already being processed.");
      }
      throw error;
    }
  });
}
