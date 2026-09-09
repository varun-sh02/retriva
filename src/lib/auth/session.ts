import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/db/server";
import { unauthorized } from "@/lib/http/api-error";
import { ensureWorkspace } from "./workspace";

export type Session = {
  user: User;
  workspaceId: string;
  supabase: SupabaseClient;
};

/**
 * Resolves the authenticated session for the current request, or throws a
 * 401 ApiError. `workspaceId` is derived here, from the verified user —
 * never accept a workspace id from request input (docs/security.md T1).
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createSupabaseServerClient();

  // getUser() re-verifies the token against Supabase Auth's server, unlike
  // getSession(), which only decodes unverified cookie contents. Never
  // substitute getSession() here.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw unauthorized();
  }

  const workspaceId = await ensureWorkspace(supabase, user.id);

  return { user, workspaceId, supabase };
}
