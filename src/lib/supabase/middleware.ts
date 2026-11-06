import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session, validates the user against the
 * Supabase Auth server (getUser) and loads their profile in parallel.
 *
 * Returns the client, the verified user (or null), their profile, and the
 * response with updated cookies.
 */
// reads the user id (sub) from the access token without verifying it.
// only used to start the profile query early, see below
function userIdFromToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          // First, update the request cookies so downstream Server
          // Components see the refreshed values.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Then rebuild the response so the browser also gets the
          // updated Set-Cookie headers.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Use getUser(), not getSession(). getUser() actually
  // hits the Supabase Auth server to validate the token; getSession()
  // only reads the local JWT and could be stale or tampered with.
  // the profile query and the auth check run at the same time instead of one
  // after the other. the user id for the profile query comes from the session
  // cookie; it is only trusted if the auth server confirms the same user, and
  // the database checks the token itself anyway (rls).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionUserId = userIdFromToken(session?.access_token);

  if (!sessionUserId) {
    return { supabase, user: null, supabaseResponse, profile: null, profileError: null };
  }

  const [userResult, profileResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", sessionUserId)
      .single(),
  ]);

  const user = userResult.data.user;
  if (!user || user.id !== sessionUserId) {
    return { supabase, user: null, supabaseResponse, profile: null, profileError: null };
  }

  return {
    supabase,
    user,
    supabaseResponse,
    profile: profileResult.data as { role: string | null; must_change_password: boolean | null } | null,
    profileError: profileResult.error,
  };
}
