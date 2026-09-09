/**
 * Multimodal image eval suite (docs/evaluation.md §5, image subset).
 * Uses a real generated PNG (not a 1x1 stub) so vision analysis has actual
 * content to describe, and verifies the full path: dual-vector chunking
 * (ADR-005), real embeddings in Qdrant, retrieval, citation, and the
 * evidence drawer's source route.
 *
 * Requires the dev server running at localhost:3000.
 * Run: NODE_OPTIONS="--conditions=react-server" npx tsx evals/multimodal-images.eval.ts
 */
process.loadEnvFile(".env.local");

import sharp from "sharp";
import { QdrantClient } from "@qdrant/js-client-rest";
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

async function makeDiagramPng(): Promise<Buffer> {
  const width = 400;
  const height = 200;
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  });
  const blueBox = await sharp({
    create: { width: 150, height: 80, channels: 3, background: { r: 30, g: 90, b: 200 } },
  })
    .png()
    .toBuffer();
  const greenBox = await sharp({
    create: { width: 150, height: 80, channels: 3, background: { r: 30, g: 160, b: 60 } },
  })
    .png()
    .toBuffer();

  return base
    .composite([
      { input: blueBox, left: 20, top: 60 },
      { input: greenBox, left: 220, top: 60 },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const user = await makeSession(admin, "eval-image");
  cleanupUserIds.push(user.userId);

  const kbResp = await api(user.cookieHeader, "/api/knowledge-bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Image Eval KB" }),
  });
  const kbId = kbResp.body.id;

  const pngBytes = await makeDiagramPng();
  const result = await uploadAndProcess(user.cookieHeader, kbId, "diagram.png", "image/png", pngBytes);
  check("image document reaches READY", result.final.status === "READY", JSON.stringify(result.final));

  const { data: chunks } = await admin.from("chunks").select("*").eq("document_id", result.documentId);

  check("exactly two chunk rows produced (text + image vector_kind)", chunks?.length === 2);
  check("one chunk has vector_kind 'text'", chunks?.some((c) => c.vector_kind === "text"));
  check("one chunk has vector_kind 'image'", chunks?.some((c) => c.vector_kind === "image"));
  check(
    "both chunks got embedded and indexed",
    chunks?.every((c) => c.embedding_model === "gemini-embedding-2" && c.qdrant_point_id !== null),
  );

  const textChunk = chunks?.find((c) => c.vector_kind === "text");
  check(
    "vision analysis produced a real description (not a stub) matching the generated colors",
    /blue|green/i.test(textChunk?.content ?? ""),
    textChunk?.content,
  );

  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantApiKey = process.env.QDRANT_API_KEY;
  const qdrantCollection = process.env.QDRANT_COLLECTION;
  if (!qdrantUrl || !qdrantApiKey || !qdrantCollection || !chunks) {
    throw new Error("Missing Qdrant env or chunk rows");
  }

  const qdrant = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey });
  const qdrantPoints = await qdrant.retrieve(qdrantCollection, {
    ids: chunks.map((c) => c.qdrant_point_id),
    with_payload: true,
    with_vector: true,
  });
  check("both Qdrant points exist with 1536-d vectors", qdrantPoints.length === 2 && qdrantPoints.every((p) => (p.vector as number[]).length === 1536));

  const turn = await streamChat(user.cookieHeader, kbId, "What does the diagram show?");
  check("chat answer cites the image", turn.citations.length > 0);
  check(
    "citation contentType is 'image'",
    turn.citations.some((c: { contentType: string }) => c.contentType === "image"),
  );
  check(
    "at most one context slot occupied per document (dedup, ADR-005)",
    new Set(turn.citations.map((c: { documentId: string }) => c.documentId)).size ===
      turn.citations.length,
  );

  if (turn.citations.length > 0) {
    const sourceResp = await api(user.cookieHeader, `/api/sources/${turn.citations[0].chunkId}`, {
      method: "GET",
    });
    check("evidence drawer source route returns assetKind 'image'", sourceResp.body.assetKind === "image");
    check(
      "evidence drawer source route returns a real signed asset URL",
      typeof sourceResp.body.assetUrl === "string" && sourceResp.body.assetUrl.includes("token="),
    );
  }

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
