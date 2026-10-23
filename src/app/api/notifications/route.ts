import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const postNotificationSchema = z.object({
  markAllRead: z.boolean().optional(),
  notificationIds: z.array(z.string().uuid("Invalid notification ID.")).max(100, "Cannot update more than 100 notifications at once.").optional(),
});

/**
 * GET /api/notifications
 * Fetch notifications for the current user (latest 20).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: count || 0,
    });
  } catch (err: unknown) {
    console.error("Notifications error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Mark notifications as read.
 * Body: { notificationIds: string[] } or { markAllRead: true }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = postNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid notification request." },
        { status: 400 }
      );
    }
    const { markAllRead, notificationIds } = parsed.data;

    if (markAllRead) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
    } else if (notificationIds && notificationIds.length > 0) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", notificationIds)
        .eq("recipient_id", user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Notifications error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

const deleteNotificationSchema = z.object({
  id: z.string().uuid("Invalid notification ID.").optional(),
});

/**
 * DELETE /api/notifications
 * Clear notifications for current user.
 * Body: { id?: string }
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = deleteNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request." },
        { status: 400 }
      );
    }

    const { id } = parsed.data;
    const admin = createAdminClient();

    let query = admin.from("notifications").delete().eq("recipient_id", user.id);
    if (id) {
      query = query.eq("id", id);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Delete notifications error:", err);
    return NextResponse.json(
      { error: "Couldn't clear notifications. Please try again." },
      { status: 500 }
    );
  }
}
