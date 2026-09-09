/**
 * Tenant isolation eval suite (docs/evaluation.md §6) — a hard release gate.
 * Two workspaces, disjoint corpora with sentinel strings. Any failure here
 * blocks the phase — no exceptions.
 *
 * Requires the dev server running at localhost:3000.
 * Run: NODE_OPTIONS="--conditions=react-server" npx tsx evals/isolation.eval.ts
 */
process.loadEnvFile(".env.local");

import {
  api,
  getAdminClient,
  makeChecker,
  makeSession,
  report,
  streamChat,
  uploadAndProcess,
} from "./lib/test-helpers.mjs";

const admin = getAdminClient();
const results: { name: string; pass: boolean }[] = [];
const check = makeChecker(results);
const cleanupUserIds: string[] = [];

const SENTINEL_A = "ATLAS_SENTINEL_7Q2";
const SENTINEL_B = "RIVAL_SENTINEL_9X4";

async function main() {
  const userA = await makeSession(admin, "eval-isolation-a");
  const userB = await makeSession(admin, "eval-isolation-b");
  cleanupUserIds.push(userA.userId, userB.userId);

  const kbAResp = await api(userA.cookieHeader, "/api/knowledge-bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Isolation Eval A" }),
  });
  const kbBResp = await api(userB.cookieHeader, "/api/knowledge-bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Isolation Eval B" }),
  });
  const kbA = kbAResp.body.id;
  const kbB = kbBResp.body.id;

  await uploadAndProcess(
    userA.cookieHeader,
    kbA,
    "secret-a.md",
    "text/markdown",
    Buffer.from(`# Confidential\n\nThe project codename is ${SENTINEL_A}.`),
  );
  const docB = await uploadAndProcess(
    userB.cookieHeader,
    kbB,
    "secret-b.md",
    "text/markdown",
    Buffer.from(`# Confidential\n\nThe project codename is ${SENTINEL_B}.`),
  );

  // --- Vector isolation: A's query for B's sentinel returns none of B's chunks ---
  const turnAforB = await streamChat(userA.cookieHeader, kbA, `What is ${SENTINEL_B}?`);
  check(
    "A's answer never contains B's sentinel string",
    !turnAforB.answer.includes(SENTINEL_B),
    turnAforB.answer,
  );
  check("A's query for B's secret refuses (no evidence in A's KB)", turnAforB.citations.length === 0);

  // --- API: cross-tenant KB access is 404, not 403 ---
  const crossGetKb = await api(userA.cookieHeader, `/api/knowledge-bases/${kbB}`, { method: "GET" });
  check("GET another user's KB returns 404", crossGetKb.status === 404, JSON.stringify(crossGetKb.body));

  // --- API: cross-tenant document access is 404 ---
  const crossDoc = await api(userA.cookieHeader, `/api/documents/${docB.documentId}/status`, {
    method: "GET",
  });
  check("GET another user's document status returns 404", crossDoc.status === 404);

  // --- API: cross-tenant chat is 404 ---
  const crossChat = await api(userA.cookieHeader, "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ knowledgeBaseId: kbB, message: "anything" }),
  });
  check("chat on another user's KB returns 404", crossChat.status === 404);

  // --- Body injection: a workspaceId-shaped field in the body is ignored ---
  const injectedCreate = await api(userA.cookieHeader, "/api/knowledge-bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Injected KB", workspaceId: "00000000-0000-0000-0000-000000000000" }),
  });
  const { data: injectedRow } = await admin
    .from("knowledge_bases")
    .select("workspace_id")
    .eq("id", injectedCreate.body.id)
    .single();
  check(
    "a client-supplied workspaceId in the body is ignored; row uses the session's real workspace",
    injectedRow?.workspace_id !== "00000000-0000-0000-0000-000000000000",
  );

  // --- Source route: cross-tenant chunk access is 404 ---
  const { data: chunkB, error: chunkBError } = await admin
    .from("chunks")
    .select("id")
    .eq("knowledge_base_id", kbB)
    .limit(1)
    .single();
  if (chunkBError || !chunkB) throw new Error(`Could not fetch a chunk for kbB: ${chunkBError?.message}`);

  const crossSource = await api(userA.cookieHeader, `/api/sources/${chunkB.id}`, { method: "GET" });
  check("GET another user's chunk via /api/sources returns 404", crossSource.status === 404);

  // --- Deletion completeness: after deleting A's document, its vectors return zero results ---
  const { data: docARow, error: docAError } = await admin
    .from("documents")
    .select("id")
    .eq("knowledge_base_id", kbA)
    .single();
  if (docAError || !docARow) throw new Error(`Could not fetch A's document: ${docAError?.message}`);

  await api(userA.cookieHeader, `/api/documents/${docARow.id}`, { method: "DELETE" });

  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;
  const qdrantCollection = process.env.QDRANT_COLLECTION;
  if (!qdrantUrl || !qdrantApiKey || !qdrantCollection) {
    throw new Error("QDRANT_URL/QDRANT_API_KEY/QDRANT_COLLECTION must be set");
  }

  const { QdrantClient } = await import("@qdrant/js-client-rest");
  const qdrant = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey });
  const remaining = await qdrant.query(qdrantCollection, {
    query: new Array(1536).fill(0.01),
    filter: { must: [{ key: "document_id", match: { value: docARow.id } }] },
    limit: 1,
  });
  check(
    "deleted document's vectors are gone from Qdrant immediately",
    remaining.points.length === 0,
    `found ${remaining.points.length} remaining points`,
  );

  report(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const id of cleanupUserIds) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  });
