import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/server";

/**
 * PKCE callback target for the magic-link email
 * (see NEXT_PUBLIC_APP_URL/auth/callback used as emailRedirectTo).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/app`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
}
