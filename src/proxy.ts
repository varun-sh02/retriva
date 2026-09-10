import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { clientEnv } from "@/lib/config/client-env";

/**
 * Refreshes the Supabase session on every request and writes rotated cookies
 * back to the response. Server Components cannot set cookies themselves
 * (see src/lib/db/server.ts), so this is what keeps their session reads
 * valid — removing it causes random logouts and early session termination.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not remove: this triggers the token refresh and cookie rewrite above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, origin } = request.nextUrl;
  // /embed/<token> is the widget iframe: authenticated by an unguessable
  // share token, never by a session. Without this it would be redirected to
  // /sign-in and the widget would render a login page inside the frame.
  const isPublicPath =
    pathname === "/sign-in" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/sign-out" ||
    pathname.startsWith("/embed/") ||
    // The widget loader is fetched by anonymous browsers on third-party
    // sites. The matcher below excludes _next/static and images but not a
    // plain .js file at the root, so without this it is redirected to
    // /sign-in and every embed silently fails to load.
    pathname === "/widget.js";
  // API routes own their own 401 JSON via requireSession() (docs/api-contracts.md
  // §1) — redirecting them to /sign-in here would turn an unauthenticated
  // fetch into a 307 to an HTML page instead of the documented error envelope.
  const isApiPath = pathname.startsWith("/api/");

  if (!user && !isPublicPath && !isApiPath) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  if (user && (pathname === "/" || pathname === "/sign-in")) {
    return NextResponse.redirect(`${origin}/app`);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
