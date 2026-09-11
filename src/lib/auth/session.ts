import "server-only";
import { cache } from "react";
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
 *
 * Memoized per request with React.cache. Rendering one page calls this three
 * times — the app layout, the knowledge base layout, and the page itself —
 * and each call was a full getUser() round trip to Supabase Auth plus a
 * workspaces SELECT. Measured against a real project that is ~940ms of
 * network wait, paid three times for an answer that cannot change inside a
 * single request.
 *
 * This does NOT weaken the rule that every route verifies for itself: each
 * call site still calls requireSession() rather than trusting an upstream
 * check, and the verification still happens. It happens once per request
 * instead of once per caller. The cache is request-scoped, so a different
 * request — a different user — shares nothing.
 */
export const requireSession = cache(async function requireSession(): Promise<Session> {
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
});
