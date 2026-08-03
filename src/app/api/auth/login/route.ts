import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

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
export async function POST(request: Request) {
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
    let email = identifier;

    // ── Resolve roll number → email ──────────────────────────
    // If the identifier doesn't contain "@", treat it as a roll number.
    if (!identifier.includes("@")) {
      const admin = createAdminClient();
      const { data: profile, error: lookupError } = await admin
        .from("profiles")
        .select("email")
        .ilike("roll_number", identifier)
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
