import "server-only";
import { getQdrantClient, QDRANT_COLLECTION } from "./client";
import { withQdrantRetry } from "./retry";

export type RetrievedPoint = {
  chunkId: string;
  score: number;
  documentId: string;
  contentType: string;
  vectorKind: string;
};

/**
 * `workspaceId` and `knowledgeBaseId` are required, non-nullable — this is
 * the actual enforcement mechanism, not documentation of one
 * (docs/security.md T2). There is no overload or raw-filter escape hatch
 * that allows a tenant-unscoped search; omitting either argument is a
 * compile error, verified in tests/qdrant-search.test.ts.
 */
export type SearchChunksParams = {
  workspaceId: string;
  knowledgeBaseId: string;
  vector: number[];
  limit: number;
  scoreThreshold?: number;
};

export async function searchChunks(params: SearchChunksParams): Promise<RetrievedPoint[]> {
  const client = getQdrantClient();

  const result = await withQdrantRetry(() =>
    client.query(QDRANT_COLLECTION, {
      query: params.vector,
      filter: {
        must: [
          { key: "workspace_id", match: { value: params.workspaceId } },
          { key: "knowledge_base_id", match: { value: params.knowledgeBaseId } },
        ],
      },
      limit: params.limit,
      score_threshold: params.scoreThreshold,
      with_payload: true,
    }),
  );

  return result.points.map((point) => {
    const payload = (point.payload ?? {}) as Record<string, unknown>;

    // Post-search assertion: should never fire. If it does, something is
    // badly wrong and the request must not proceed — see docs/security.md T2.
    if (payload.workspace_id !== params.workspaceId) {
      throw new Error(
        `CRITICAL tenant isolation violation: Qdrant returned a point with ` +
          `workspace_id="${String(payload.workspace_id)}" while searching as ` +
          `workspace_id="${params.workspaceId}".`,
      );
    }

    return {
      chunkId: String(point.id),
      score: point.score,
      documentId: String(payload.document_id),
      contentType: String(payload.content_type),
      vectorKind: String(payload.vector_kind),
    };
  });
}
