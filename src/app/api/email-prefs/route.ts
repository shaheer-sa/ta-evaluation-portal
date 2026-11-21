import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// the student's own email choices (for now just "email me about new marks")

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const { data } = await createAdminClient().from("profiles").select("marks_email").eq("id", user.id).single();
  return NextResponse.json({ marksEmail: !!data?.marks_email });
}

const schema = z.object({ marksEmail: z.boolean() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // only this one column, and only for the signed-in student
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ marks_email: parsed.data.marksEmail })
    .eq("id", user.id)
    .eq("role", "student");
  if (error) {
    console.error("email prefs update failed:", error.code, error.message);
    return NextResponse.json({ error: `Couldn't save your choice (code ${error.code}).` }, { status: 500 });
  }
  return NextResponse.json({ marksEmail: parsed.data.marksEmail });
}
