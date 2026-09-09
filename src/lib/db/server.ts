import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/config/client-env";

/**
 * Session-bound Supabase client for Server Components and Route Handlers.
 * RLS applies to every query made through it — this is the default database
 * client for the application. Create a new one per request; never share
 * across requests (see @supabase/ssr's own createServerClient docs).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, which cannot set
            // cookies. Session refresh is instead handled by middleware
            // (src/middleware.ts) on every request.
          }
        },
      },
    },
  );
}
