import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/sign-in", request.url));
}
