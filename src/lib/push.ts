// Web Push: sends a phone/desktop notification to every device a user turned
// notifications on for. Does nothing if the VAPID keys aren't set.
import webpush from "web-push";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type PushMessage = { title: string; body?: string; url?: string; tag?: string };

let configured: boolean | null = null;
function ready() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:tams.official.notifications@gmail.com";
  configured = !!(pub && priv);
  if (configured) {
    try {
      webpush.setVapidDetails(subject, pub as string, priv as string);
    } catch (err) {
      // usually a key copied with a missing character or an extra space
      console.error("push keys are invalid, notifications are off:", err instanceof Error ? err.message : err);
      configured = false;
    }
  }
  return configured;
}

/**
 * one message per user id; users with no devices are skipped.
 * Returns the users it reached on at least one device.
 */
export async function sendPush(
  admin: Admin,
  messages: { userId: string; message: PushMessage }[]
): Promise<Set<string>> {
  const reached = new Set<string>();
  if (messages.length === 0 || !ready()) return reached;
  const userIds = [...new Set(messages.map((m) => m.userId))];
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs || subs.length === 0) return reached;

  const dead: string[] = [];
  await Promise.allSettled(
    messages.flatMap(({ userId, message }) =>
      subs
        .filter((s) => s.user_id === userId)
        .map((s) =>
          webpush
            .sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ ...message, body: (message.body || "").slice(0, 180) }),
              { TTL: 60 * 60 * 24 }
            )
            .then(() => {
              reached.add(userId);
            })
            .catch((err: { statusCode?: number }) => {
              // the device unsubscribed or the browser dropped it: forget it
              if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.id);
              else console.error("push failed:", err?.statusCode);
            })
        )
    )
  );
  if (dead.length > 0) await admin.from("push_subscriptions").delete().in("id", dead);
  return reached;
}

type NotificationRow = { recipient_id: string; type: string; title: string; body?: string | null; related_id?: string | null };

/** where tapping the phone notification should go (mirrors the bell) */
function urlFor(n: NotificationRow, role: string | undefined): string {
  const id = n.related_id;
  switch (n.type) {
    case "marks_updated":
      return id ? `/student/course/${id}` : "/student";
    case "issue_report":
      return id ? `/ta/reports?open=${id}` : "/ta/reports";
    case "issue_resolved":
      return "/student";
    case "password_reset_request":
      return id ? `/ta/roster?student=${id}` : "/ta/roster";
    case "new_query":
    case "query_reply":
    case "query_update": {
      const base = role === "ta" ? "/ta/queries" : "/student/queries";
      return id ? `${base}?open=${id}` : base;
    }
    default:
      return role === "ta" ? "/ta" : "/student";
  }
}

/** push for notification rows that were just saved (same title/body as the bell) */
export async function pushForNotifications(admin: Admin, rows: NotificationRow[]): Promise<Set<string>> {
  if (rows.length === 0 || !ready()) return new Set();
  const ids = [...new Set(rows.map((r) => r.recipient_id))];
  const { data: roles } = await admin.from("profiles").select("id, role").in("id", ids);
  const roleOf = new Map((roles || []).map((r) => [r.id, r.role as string]));
  return sendPush(
    admin,
    rows.map((r) => ({
      userId: r.recipient_id,
      message: {
        title: r.title,
        body: r.body || "",
        url: urlFor(r, roleOf.get(r.recipient_id)),
        tag: r.related_id ? `${r.type}:${r.related_id}` : r.type,
      },
    }))
  );
}

/**
 * Starts the phone notifications right away. Await the result before sending
 * emails: people it reached don't get the same update by email too (if it
 * reached none of their devices, they still get the email).
 */
export function startPush(admin: Admin, rows: NotificationRow[]): Promise<Set<string>> {
  return pushForNotifications(admin, rows).catch((err) => {
    console.error("push failed:", err);
    return new Set<string>();
  });
}
