import "server-only";
import type { HistoryTurn } from "@/lib/retrieval/rewrite";
import { INSUFFICIENT_EVIDENCE_MESSAGE } from "./prompt";

type MessageRow = { role: "user" | "assistant"; content: string };

/**
 * Turns the raw `messages` rows into the history actually sent to the model.
 *
 * The rows are NOT usable as-is. A turn only persists its assistant reply on
 * the success path (see persistTurn in the chat route), so any request that
 * failed — a Gemini 429, a dropped stream — leaves the user row behind with
 * no answer after it. Feeding those through verbatim breaks generation in two
 * separate ways, both reproduced against this KB:
 *
 *  1. A trailing orphan user row lands immediately before the current turn,
 *     so the model sees two user messages in a row and answers the *stale*
 *     one. A window ending "what is my weight?" made every later question —
 *     "what is my name?" included — refuse, because the resume genuinely has
 *     no weight in it. Dropping that one row fixes the answer outright.
 *  2. Past refusals act as few-shot examples. A window that is mostly
 *     "user asks / assistant refuses" teaches the model to refuse again even
 *     when the retrieved context plainly contains the answer.
 *
 * So: keep only complete user→assistant exchanges, drop the ones that refused
 * (a refusal carries no information worth conditioning on), and keep the most
 * recent `limit` messages rather than the oldest.
 */
export function buildHistory(rows: MessageRow[], limit: number): HistoryTurn[] {
  const exchanges: HistoryTurn[][] = [];

  for (let i = 0; i < rows.length; i++) {
    const user = rows[i];
    if (user?.role !== "user") continue;

    // Consecutive user rows mean the earlier ones never got an answer; the
    // last one before an assistant reply is the question that was answered.
    const next = rows[i + 1];
    if (next?.role !== "assistant") continue;

    if (next.content.trim() !== INSUFFICIENT_EVIDENCE_MESSAGE) {
      exchanges.push([
        { role: "user", content: user.content },
        { role: "assistant", content: next.content },
      ]);
    }
    i++;
  }

  // Slice whole exchanges, newest first, so the window never starts on a
  // dangling assistant turn or splits a pair.
  const history: HistoryTurn[] = [];
  for (let i = exchanges.length - 1; i >= 0; i--) {
    const exchange = exchanges[i];
    if (!exchange) continue;
    if (history.length + exchange.length > limit) break;
    history.unshift(...exchange);
  }

  return history;
}
