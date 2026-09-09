import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the caller's workspace id, creating it on first authenticated
 * request. Idempotent under concurrent calls: the UNIQUE(owner_id)
 * constraint (supabase/migrations/0001_workspaces.sql) makes a second
 * concurrent insert fail with a unique violation, which is treated as
 * "already exists" rather than an error.
 */
export async function ensureWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    return existing.id as string;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("workspaces")
    .insert({ owner_id: userId })
    .select("id")
    .single();

  if (insertError) {
    // 23505 = unique_violation: a concurrent request created the workspace
    // first. Re-select rather than treating this as a failure.
    if (insertError.code === "23505") {
      const { data: raceWinner, error: raceSelectError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", userId)
        .single();

      if (raceSelectError) {
        throw raceSelectError;
      }

      return raceWinner.id as string;
    }

    throw insertError;
  }

  return inserted.id as string;
}
