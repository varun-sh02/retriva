/**
 * Negative retrieval eval suite (docs/evaluation.md §7). Checks refusal on
 * out-of-corpus and adjacent-but-absent questions, and — equally
 * important — that answerable questions are NOT falsely refused. A system
 * that refuses everything would pass a refusal-only suite; this pairs both.
 *
 * Requires the dev server running at localhost:3000.
 * Run: NODE_OPTIONS="--conditions=react-server" npx tsx evals/negative.eval.ts
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

const REFUSAL_STRING =
  "I couldn't find enough evidence in this knowledge base to answer that confidently.";

async function main() {
  const user = await makeSession(admin, "eval-negative");
  cleanupUserIds.push(user.userId);

  const kbResp = await api(user.cookieHeader, "/api/knowledge-bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Negative Eval KB" }),
  });
  const kbId = kbResp.body.id;

  await uploadAndProcess(
    user.cookieHeader,
    kbId,
    "notes.md",
    "text/markdown",
    Buffer.from("# Stack\n\nThe backend uses NestJS and PostgreSQL. Deployment runs on Vercel."),
  );

  // --- Out-of-corpus: plausible question the corpus simply doesn't cover ---
  const outOfCorpus = await streamChat(user.cookieHeader, kbId, "What is the company's parental leave policy?");
  check(
    "out-of-corpus question refuses with the exact documented string",
    outOfCorpus.answer.trim() === REFUSAL_STRING,
    outOfCorpus.answer,
  );

  // --- Adjacent-but-absent: topically close, factually not covered ---
  const adjacent = await streamChat(user.cookieHeader, kbId, "What frontend framework version is pinned in package.json?");
  check(
    "adjacent-but-absent question refuses rather than guessing",
    adjacent.answer.trim() === REFUSAL_STRING || adjacent.citations.length === 0,
    adjacent.answer,
  );

  // --- Empty KB: a second knowledge base with zero documents refuses everything ---
  const emptyKbResp = await api(user.cookieHeader, "/api/knowledge-bases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Empty KB" }),
  });
  const emptyTurn = await streamChat(user.cookieHeader, emptyKbResp.body.id, "What technology is used?");
  check(
    "a knowledge base with zero documents refuses every question",
    emptyTurn.answer.trim() === REFUSAL_STRING,
    emptyTurn.answer,
  );

  // --- False-refusal check: a genuinely answerable question must NOT refuse ---
  const answerable = await streamChat(user.cookieHeader, kbId, "What backend framework is used?");
  check(
    "an answerable question is answered, not refused (false-refusal check)",
    answerable.answer.trim() !== REFUSAL_STRING && /nestjs/i.test(answerable.answer),
    answerable.answer,
  );
  check("the answerable question's answer carries a citation", answerable.citations.length > 0);

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
