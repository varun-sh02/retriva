/**
 * Verifies the live environment before implementation proceeds:
 * - env vars parse (via serverEnv/clientEnv)
 * - GEMINI_MODEL actually exists on this API account (never silently substituted — ADR-002)
 * - gemini-embedding-2 returns the expected vector dimension
 * - Qdrant cluster is reachable
 *
 * Run with: npm run preflight
 */
import { existsSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { QdrantClient } from "@qdrant/js-client-rest";
import type { serverEnv as ServerEnvModule } from "../src/lib/config/server-env.core";

type ServerEnv = typeof ServerEnvModule;

const EXPECTED_EMBEDDING_DIMENSIONS = 1536;

type CheckResult = { name: string; status: "PASS" | "WARN" | "FAIL"; detail: string };

const results: CheckResult[] = [];

function record(name: string, status: CheckResult["status"], detail: string) {
  results.push({ name, status, detail });
  const icon = status === "PASS" ? "✔" : status === "WARN" ? "⚠" : "✘";
  console.log(`${icon} ${name} — ${detail}`);
}

async function checkGeminiModel(ai: GoogleGenAI, serverEnv: ServerEnv) {
  const pager = await ai.models.list({ config: { pageSize: 200 } });
  const names: string[] = [];
  for await (const model of pager) {
    if (model.name) names.push(model.name.replace(/^models\//, ""));
  }

  const primaryAvailable = names.includes(serverEnv.GEMINI_MODEL);
  if (primaryAvailable) {
    record("gemini_model", "PASS", `${serverEnv.GEMINI_MODEL} is available on this account`);
    return;
  }

  const fallback = serverEnv.GEMINI_FALLBACK_MODEL;
  const fallbackAvailable = fallback ? names.includes(fallback) : false;

  const flashLiteCandidates = names.filter((n) => /flash-lite/i.test(n));
  const suggestion =
    flashLiteCandidates.length > 0
      ? `Available Flash-Lite models on this account: ${flashLiteCandidates.join(", ")}`
      : `No Flash-Lite models found. All available models: ${names.join(", ")}`;

  if (fallbackAvailable) {
    record(
      "gemini_model",
      "WARN",
      `GEMINI_MODEL="${serverEnv.GEMINI_MODEL}" not found, but GEMINI_FALLBACK_MODEL="${fallback}" is available. ${suggestion}`,
    );
    return;
  }

  record(
    "gemini_model",
    "FAIL",
    `GEMINI_MODEL="${serverEnv.GEMINI_MODEL}" does not exist on this account and no working fallback is configured. ${suggestion}. ` +
      `Set GEMINI_MODEL to one of the models listed above.`,
  );
}

async function checkEmbeddingDimensions(ai: GoogleGenAI, serverEnv: ServerEnv) {
  const response = await ai.models.embedContent({
    model: serverEnv.GEMINI_EMBEDDING_MODEL,
    contents: "retriva preflight embedding check",
    config: { outputDimensionality: EXPECTED_EMBEDDING_DIMENSIONS },
  });

  const vector = response.embeddings?.[0]?.values;
  if (!vector) {
    record(
      "gemini_embedding",
      "FAIL",
      `${serverEnv.GEMINI_EMBEDDING_MODEL} returned no embedding values`,
    );
    return;
  }

  if (vector.length !== EXPECTED_EMBEDDING_DIMENSIONS) {
    record(
      "gemini_embedding",
      "FAIL",
      `${serverEnv.GEMINI_EMBEDDING_MODEL} returned a ${vector.length}-d vector, expected ${EXPECTED_EMBEDDING_DIMENSIONS}-d`,
    );
    return;
  }

  record(
    "gemini_embedding",
    "PASS",
    `${serverEnv.GEMINI_EMBEDDING_MODEL} returns ${EXPECTED_EMBEDDING_DIMENSIONS}-d vectors as configured`,
  );
}

async function checkQdrant(serverEnv: ServerEnv) {
  const client = new QdrantClient({
    url: serverEnv.QDRANT_URL,
    apiKey: serverEnv.QDRANT_API_KEY,
  });

  const { collections } = await client.getCollections();
  const hasTargetCollection = collections.some((c) => c.name === serverEnv.QDRANT_COLLECTION);

  record(
    "qdrant",
    "PASS",
    hasTargetCollection
      ? `reachable; collection "${serverEnv.QDRANT_COLLECTION}" already exists`
      : `reachable; collection "${serverEnv.QDRANT_COLLECTION}" does not exist yet (created at TASK-024)`,
  );
}

async function main() {
  // `.env.local` must be loaded, and the env modules imported, only after
  // this runs. Static top-level `import` statements are hoisted above
  // ordinary statements, so they would parse env vars before loadEnvFile
  // ever populates process.env — hence the dynamic import() below, inside
  // an async function rather than at the top level (top-level await isn't
  // supported by tsx's default CJS transform for a plain .ts file).
  if (existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const { clientEnv } = await import("../src/lib/config/client-env");
  // Imports the unguarded core module directly — this is a standalone Node
  // script, not part of the Next.js bundle, so the `server-only` guard in
  // ../src/lib/config/server-env.ts would throw here. See that file's comment.
  const { serverEnv } = await import("../src/lib/config/server-env.core");

  // Importing the two modules above already throws on invalid config.
  // Reaching this line means both parsed successfully.
  void clientEnv;
  record("env", "PASS", "serverEnv and clientEnv parsed successfully");

  const ai = new GoogleGenAI({ apiKey: serverEnv.GEMINI_API_KEY });

  try {
    await checkGeminiModel(ai, serverEnv);
  } catch (error) {
    record("gemini_model", "FAIL", error instanceof Error ? error.message : String(error));
  }

  try {
    await checkEmbeddingDimensions(ai, serverEnv);
  } catch (error) {
    record("gemini_embedding", "FAIL", error instanceof Error ? error.message : String(error));
  }

  try {
    await checkQdrant(serverEnv);
  } catch (error) {
    record("qdrant", "FAIL", error instanceof Error ? error.message : String(error));
  }

  console.log("");
  const hasFailure = results.some((r) => r.status === "FAIL");
  if (hasFailure) {
    console.error("Preflight FAILED — fix the issues above before implementing further tasks.");
    process.exit(1);
  }
  console.log("Preflight passed.");
}

main().catch((error) => {
  console.error("Preflight crashed:", error);
  process.exit(1);
});
