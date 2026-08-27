import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const schema = z.object({
  identifier: z.string().min(1, "Enter your email or roll number"),
});

/**
 * POST /api/auth/forgot-password
 *
 * Accepts either an email or a roll number — same identifier rule as
 * login. Sends a password reset email via Supabase Auth.
 *
 * Always returns the same generic 200 response regardless of whether
 * the identifier matches a real account, and regardless of whether it
 * was an email or a roll number — this prevents both email
 * enumeration AND roll-number enumeration.
 */
const forgotPasswordRateLimit = createRateLimiter({ tokens: 3, window: "1 h" });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { identifier } = parsed.data;

    if (forgotPasswordRateLimit) {
      const ip = getClientIp(request);
      const { success, reset } = await forgotPasswordRateLimit.limit(`forgot-password:${ip}`);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: "Too many attempts, please try again later" },
          { 
            status: 429,
            headers: { "Retry-After": retryAfter.toString() }
          }
        );
      }
    }

    let email: string | null = null;

    if (identifier.includes("@")) {
      email = identifier;
    } else {
      // Roll number — resolve to the account's email via the admin
      // client (bypasses RLS, same pattern used by /api/auth/login).
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("email")
        .ilike("roll_number", identifier)
        .single();

      email = profile?.email ?? null;
    }

    // Only actually attempt a send if we resolved a real email — but
    // return the same generic success response either way below, so a
    // bad roll number/email can't be distinguished from a real one.
    if (email) {
      const supabase = await createClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      // The redirect goes to our auth callback, which exchanges the
      // PKCE code for a session and then redirects to /reset-password.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
