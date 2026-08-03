import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 *
 * Handles the redirect from Supabase email links (password reset,
 * email confirmation, etc.). Exchanges the PKCE `code` for a
 * session, then redirects to the `next` path (or /login as fallback).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/login";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or exchange failed — send to login with an error hint.
  return NextResponse.redirect(
    `${origin}/login?error=auth_callback_failed`
  );
}
