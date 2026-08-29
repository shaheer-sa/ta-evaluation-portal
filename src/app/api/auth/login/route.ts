import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { escapeLikePattern } from "@/lib/identifiers";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or roll number is required"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /api/auth/login
 *
 * Accepts { identifier, password } where `identifier` is either an
 * email address or a roll number.
 *
 * If a roll number is provided, the admin client (bypasses RLS) looks
 * up the matching email in `profiles`. The actual sign-in always goes
 * through the cookie-scoped server client so the session cookie is
 * set correctly on the response.
 */
const loginRateLimit = createRateLimiter({ tokens: 5, window: "15 m" });

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && !loginRateLimit) {
    console.error("Login blocked: rate limiter unavailable in production.");
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again shortly." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { identifier, password } = parsed.data;

    // ── Rate Limiting ────────────────────────────────────────
    if (loginRateLimit) {
      const ip = getClientIp(request);
      // Keyed on IP + submitted identifier
      const { success, reset } = await loginRateLimit.limit(`login:${ip}:${identifier}`);
      if (!success) {
        // Return 429 but generic message
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

    let email = identifier;

    // ── Resolve roll number → email ──────────────────────────
    // If the identifier doesn't contain "@", treat it as a roll number.
    if (!identifier.includes("@")) {
      const admin = createAdminClient();
      const { data: profile, error: lookupError } = await admin
        .from("profiles")
        .select("email")
        .ilike("roll_number", escapeLikePattern(identifier))
        .single();

      if (lookupError || !profile) {
        // Don't reveal whether the roll number exists — generic error.
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }

      email = profile.email;
    }

    // ── Sign in via server client (sets session cookie) ──────
    const supabase = await createClient();
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data.user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ── Return role so the client knows where to redirect ────
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    return NextResponse.json({
      role: profile?.role ?? "student",
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
