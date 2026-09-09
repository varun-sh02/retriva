import "server-only";
import { QdrantClient } from "@qdrant/js-client-rest";
import { serverEnv } from "@/lib/config/server-env";

let cachedClient: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!cachedClient) {
    cachedClient = new QdrantClient({
      url: serverEnv.QDRANT_URL,
      apiKey: serverEnv.QDRANT_API_KEY,
    });
  }
  return cachedClient;
}

export const QDRANT_COLLECTION = serverEnv.QDRANT_COLLECTION;
