import "server-only";
import { getQdrantClient, QDRANT_COLLECTION } from "./client";
import { withQdrantRetry } from "./retry";

/** Every variant still requires workspaceId — no delete path can be tenant-unscoped. */
export async function deleteChunksByDocument(
  workspaceId: string,
  documentId: string,
): Promise<void> {
  const client = getQdrantClient();
  await withQdrantRetry(() =>
    client.delete(QDRANT_COLLECTION, {
      wait: true,
      filter: {
        must: [
          { key: "workspace_id", match: { value: workspaceId } },
          { key: "document_id", match: { value: documentId } },
        ],
      },
    }),
  );
}

export async function deleteChunksByKnowledgeBase(
  workspaceId: string,
  knowledgeBaseId: string,
): Promise<void> {
  const client = getQdrantClient();
  await withQdrantRetry(() =>
    client.delete(QDRANT_COLLECTION, {
      wait: true,
      filter: {
        must: [
          { key: "workspace_id", match: { value: workspaceId } },
          { key: "knowledge_base_id", match: { value: knowledgeBaseId } },
        ],
      },
    }),
  );
}

export async function deleteChunksByWorkspace(workspaceId: string): Promise<void> {
  const client = getQdrantClient();
  await withQdrantRetry(() =>
    client.delete(QDRANT_COLLECTION, {
      wait: true,
      filter: {
        must: [{ key: "workspace_id", match: { value: workspaceId } }],
      },
    }),
  );
}
