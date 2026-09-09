import { getGeminiClient } from "@/lib/gemini/client";
import { getQdrantClient, QDRANT_COLLECTION } from "@/lib/qdrant/client";
import { createSupabaseServiceClient } from "@/lib/db/service";

/**
 * Unauthenticated, no secrets in the response (docs/api-contracts.md §6).
 * Doubles as the Qdrant free-cluster keep-alive target — a scheduled ping
 * here (see vercel.json's cron entry) is what prevents the free-tier
 * cluster from suspending after a week of inactivity
 * (docs/architecture.md §12, docs/security.md "Incident response").
 */
export async function GET() {
  const [db, qdrant, gemini] = await Promise.all([checkDb(), checkQdrant(), checkGemini()]);

  const allHealthy = db && qdrant && gemini;

  return Response.json(
    { status: allHealthy ? "ok" : "degraded", checks: { db, qdrant, gemini } },
    { status: allHealthy ? 200 : 503 },
  );
}

async function checkDb(): Promise<boolean> {
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service.from("workspaces").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function checkQdrant(): Promise<boolean> {
  try {
    const client = getQdrantClient();
    const { collections } = await client.getCollections();
    return collections.some((c) => c.name === QDRANT_COLLECTION);
  } catch {
    return false;
  }
}

async function checkGemini(): Promise<boolean> {
  try {
    const ai = getGeminiClient();
    const pager = await ai.models.list({ config: { pageSize: 1 } });
    for await (const _model of pager) {
      return true;
    }
    return true;
  } catch {
    return false;
  }
}
