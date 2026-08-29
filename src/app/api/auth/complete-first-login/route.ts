import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  // Reject reuse of the default password.
  if (parsed.data.password.startsWith("Tams@")) {
    return NextResponse.json(
      { error: "Please choose a different password." },
      { status: 400 }
    );
  }

  // Change the password HERE. The flag can only be cleared as a consequence.
  const { error: pwError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (pwError) {
    return NextResponse.json({ error: pwError.message }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to clear must_change_password:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
