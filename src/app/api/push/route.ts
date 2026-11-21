export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const subscribeSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  // enable = the user pressed the switch; sync = page load, only if it's theirs
  mode: z.enum(["enable", "sync"]).default("enable"),
  owner: z.string().max(100).nullable().optional(),
});
const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

/** POST /api/push — turn on push notifications for this device */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = subscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });

  const admin = createAdminClient();
  const { endpoint, mode, owner } = parsed.data;

  if (mode === "sync") {
    const { data: existing } = await admin
      .from("push_subscriptions")
      .select("user_id")
      .eq("endpoint", endpoint)
      .maybeSingle();
    // fine if the server already has it for this user, or this user is the one
    // who turned notifications on in this browser (logged out and back in)
    const mine = existing?.user_id === user.id || owner === user.id;
    if (!mine) {
      // someone else turned them on here: stop their alerts coming to this
      // browser while another account is using it, and don't turn them on for this one
      if (existing) await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
      return NextResponse.json({ on: false });
    }
  }

  // the device now belongs to the signed-in user
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) || null,
      },
      { onConflict: "endpoint" }
    );
  if (error) {
    console.error("push subscribe failed:", error.code, error.message);
    return NextResponse.json({ error: `Couldn't turn on notifications (code ${error.code}).` }, { status: 500 });
  }
  return NextResponse.json({ on: true, userId: user.id });
}

/** DELETE /api/push — turn them off for this device */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const parsed = unsubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint).eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
