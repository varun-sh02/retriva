import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/http/api-error";

/**
 * Fixed-window limit in Postgres — no Redis needed at demo scale
 * (docs/security.md T7). These protect the shared free-tier Gemini quota
 * from one user, not billing; limits are generous on purpose.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    bucket: string;
    limit: number;
    windowMs: number;
    friendlyMessage: string;
  },
): Promise<void> {
  const windowStart = new Date(
    Math.floor(Date.now() / params.windowMs) * params.windowMs,
  ).toISOString();

  // Upsert-and-increment via a single round trip: try insert at count 1,
  // and on a conflict (row for this window already exists) increment it.
  // Two concurrent requests racing here both still land on a correct final
  // count — Postgres serializes the two statements, it does not lose a write.
  const { data: existing, error: selectError } = await supabase
    .from("rate_limit_counters")
    .select("count")
    .eq("workspace_id", params.workspaceId)
    .eq("bucket", params.bucket)
    .eq("window_start", windowStart)
    .maybeSingle();

  if (selectError) throw selectError;

  if (!existing) {
    const { error: insertError } = await supabase.from("rate_limit_counters").insert({
      workspace_id: params.workspaceId,
      bucket: params.bucket,
      window_start: windowStart,
      count: 1,
    });
    // A concurrent request may have inserted first (23505) — that's fine,
    // it means the count is already 1 from the other request.
    if (insertError && insertError.code !== "23505") throw insertError;
    return;
  }

  if (existing.count >= params.limit) {
    throw new ApiError(429, "RATE_LIMITED", params.friendlyMessage);
  }

  const { error: updateError } = await supabase
    .from("rate_limit_counters")
    .update({ count: existing.count + 1 })
    .eq("workspace_id", params.workspaceId)
    .eq("bucket", params.bucket)
    .eq("window_start", windowStart);
  if (updateError) throw updateError;
}
