import "server-only";
import { getGeminiClient, withRetry } from "@/lib/gemini/client";
import { serverEnv } from "@/lib/config/server-env";

export type HistoryTurn = { role: "user" | "assistant"; content: string };

const PRONOUN_PATTERN =
  /\b(it|this|that|these|those|they|them|he|she|him|her|then|there|its)\b/i;
const REWRITE_HISTORY_TURNS = 4;

/**
 * A pronoun-laden follow-up ("when was that decided?") embeds to nothing
 * useful on its own — this rewrites it into a standalone query using recent
 * history. Skipped on the first message and on long, already self-contained
 * questions, so the extra model call is paid only when it changes the
 * outcome (docs/rag-pipeline.md §3.2).
 */
export async function rewriteQuery(message: string, history: HistoryTurn[]): Promise<string> {
  if (history.length === 0 || !needsRewrite(message)) {
    return message;
  }

  const recentTurns = history
    .slice(-REWRITE_HISTORY_TURNS)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");

  const ai = getGeminiClient();
  const response = await withRetry(() =>
    ai.models.generateContent({
      model: serverEnv.GEMINI_MODEL,
      contents:
        `Conversation so far:\n${recentTurns}\n\n` +
        `Follow-up question: ${message}\n\n` +
        "Rewrite the follow-up question as a standalone question that makes sense " +
        "without the conversation above. Reply with only the rewritten question, nothing else.",
      config: { temperature: 0, maxOutputTokens: 100 },
    }),
  );

  const rewritten = response.text?.trim();
  return rewritten && rewritten.length > 0 ? rewritten : message;
}

function needsRewrite(message: string): boolean {
  const wordCount = message.trim().split(/\s+/).length;
  const isLongAndSelfContained = wordCount > 15 && !PRONOUN_PATTERN.test(message);
  return !isLongAndSelfContained;
}
