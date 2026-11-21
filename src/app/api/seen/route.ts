import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// which release notes / feature notes this user has already seen
const keySchema = z.string().regex(/^(release|note):[a-z0-9-]{1,80}$/, "Invalid key.");
const postSchema = z.object({ keys: z.array(keySchema).min(1).max(50) });

/** GET /api/seen — the current user's seen keys */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const { data, error } = await supabase.from("user_seen").select("key").eq("user_id", user.id).limit(1000);
  if (error) {
    // table not there yet (sql step pending): just treat nothing as seen
    console.error("seen load failed:", error.code, error.message);
    return NextResponse.json({ keys: [], unavailable: true });
  }
  return NextResponse.json({ keys: (data || []).map((r) => r.key) });
}

/** POST /api/seen — mark keys as seen. Body: { keys: string[] } */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const rows = [...new Set(parsed.data.keys)].map((key) => ({ user_id: user.id, key }));
  const { error } = await supabase.from("user_seen").upsert(rows, { onConflict: "user_id,key", ignoreDuplicates: true });
  if (error) {
    console.error("seen save failed:", error.code, error.message);
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
