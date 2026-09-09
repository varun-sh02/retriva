/**
 * Creates the `retriva`-equivalent Qdrant collection (name from
 * QDRANT_COLLECTION) and its required payload indexes if they don't already
 * exist. Idempotent — safe to re-run. See docs/data-model.md §8.
 *
 * Run with: npx tsx scripts/bootstrap-qdrant.ts
 */
import { existsSync } from "node:fs";
import { QdrantClient } from "@qdrant/js-client-rest";

const VECTOR_SIZE = 1536;

type TenantIndexField = { name: string; isTenant: boolean };

const KEYWORD_INDEX_FIELDS: TenantIndexField[] = [
  { name: "workspace_id", isTenant: true },
  { name: "knowledge_base_id", isTenant: false },
  { name: "document_id", isTenant: false },
  { name: "content_type", isTenant: false },
  { name: "vector_kind", isTenant: false },
];

async function main() {
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const { serverEnv } = await import("../src/lib/config/server-env.core");

  const client = new QdrantClient({
    url: serverEnv.QDRANT_URL,
    apiKey: serverEnv.QDRANT_API_KEY,
  });

  const collectionName = serverEnv.QDRANT_COLLECTION;

  const { collections } = await client.getCollections();
  const exists = collections.some((c) => c.name === collectionName);

  if (!exists) {
    await client.createCollection(collectionName, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
    console.log(`✔ created collection "${collectionName}" (${VECTOR_SIZE}-d, cosine)`);
  } else {
    const info = await client.getCollection(collectionName);
    const actualSize = info.config?.params?.vectors?.size;
    if (actualSize !== VECTOR_SIZE) {
      throw new Error(
        `Collection "${collectionName}" already exists with vector size ${actualSize}, ` +
          `expected ${VECTOR_SIZE}. Refusing to continue — mixing dimensions silently ` +
          `corrupts retrieval (see docs/technical-decisions.md ADR-003).`,
      );
    }
    console.log(`✔ collection "${collectionName}" already exists (${VECTOR_SIZE}-d, cosine)`);
  }

  for (const field of KEYWORD_INDEX_FIELDS) {
    await client.createPayloadIndex(collectionName, {
      field_name: field.name,
      field_schema: {
        type: "keyword",
        is_tenant: field.isTenant,
      },
      wait: true,
    });
    console.log(
      `✔ payload index on "${field.name}"${field.isTenant ? " (is_tenant)" : ""}`,
    );
  }

  console.log("\nQdrant bootstrap complete.");
}

main().catch((error) => {
  console.error("Qdrant bootstrap failed:", error);
  process.exit(1);
});
