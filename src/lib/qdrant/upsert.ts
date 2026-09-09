import "server-only";
import { getQdrantClient, QDRANT_COLLECTION } from "./client";
import { withQdrantRetry } from "./retry";

export type ChunkPoint = {
  chunkId: string;
  vector: number[];
  workspaceId: string;
  knowledgeBaseId: string;
  documentId: string;
  contentType: string;
  vectorKind: "text" | "image";
  documentName: string;
  pageNumber?: number | null;
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  sectionPath?: string | null;
};

/** Upsert is keyed by chunkId, so reprocessing a document overwrites cleanly with no duplicates. */
export async function upsertChunks(points: ChunkPoint[]): Promise<void> {
  if (points.length === 0) return;

  const client = getQdrantClient();

  await withQdrantRetry(() =>
    client.upsert(QDRANT_COLLECTION, {
      wait: true,
      points: points.map((point) => ({
        id: point.chunkId,
        vector: point.vector,
        payload: {
          workspace_id: point.workspaceId,
          knowledge_base_id: point.knowledgeBaseId,
          document_id: point.documentId,
          chunk_id: point.chunkId,
          content_type: point.contentType,
          vector_kind: point.vectorKind,
          document_name: point.documentName,
          page_number: point.pageNumber ?? null,
          start_timestamp: point.startTimestamp ?? null,
          end_timestamp: point.endTimestamp ?? null,
          section_path: point.sectionPath ?? null,
        },
      })),
    }),
  );
}
