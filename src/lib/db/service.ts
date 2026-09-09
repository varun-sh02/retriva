import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/config/client-env";
import { serverEnv } from "@/lib/config/server-env";

/**
 * Secret-key client — bypasses RLS entirely (docs/technical-decisions.md
 * ADR-014 addendum). Confined to migrations and collection/bootstrap
 * operations. NEVER import this from a route handler that touches a
 * client-supplied ID (docs/security.md T1/T5) — use
 * `createSupabaseServerClient()` from ./server for all request handling.
 */
export function createSupabaseServiceClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
