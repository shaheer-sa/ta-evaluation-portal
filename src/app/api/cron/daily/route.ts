export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMarksDigestEmail, sendReleaseDigestEmail } from "@/lib/email/gmail";
import { daysSince, formatReleaseDate, KIND_LABELS, releasesFor } from "@/lib/updates";

// Daily job, run by Vercel Cron (see vercel.json). Vercel calls it with
// "Authorization: Bearer <CRON_SECRET>". Two emails:
//   new marks      only to students who turned "Email me about new marks" on
//                  (off by default). MARKS_DIGEST_EMAIL=off stops it for everyone.
//   release notes  RELEASE_DIGEST_EMAIL=on, one email per release to students
//                  who haven't read it in TAMS

const RELEASE_MIN_DAYS = 3; // give students a few days to see it in TAMS first
const RELEASE_MAX_DAYS = 30; // don't email about old updates

// send a few at a time so a big class finishes well inside the time limit
async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.allSettled(items.slice(i, i + size).map(fn));
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary: Record<string, unknown> = {};

  // ── 1) new marks digest ────────────────────────────────────────
  if (process.env.MARKS_DIGEST_EMAIL !== "off") {
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: notices, error } = await admin
      .from("notifications")
      .select("id, recipient_id, title, body, related_id")
      .eq("type", "marks_updated")
      .eq("is_read", false)
      .is("emailed_at", null)
      .gte("created_at", since)
      .limit(2000);

    if (error) {
      summary.marks = { error: error.code };
    } else {
      const byStudent = new Map<string, typeof notices>();
      for (const n of notices || []) {
        const list = byStudent.get(n.recipient_id) || [];
        list.push(n);
        byStudent.set(n.recipient_id, list);
      }
      const ids = [...byStudent.keys()];
      const { data: people } = ids.length
        ? await admin.from("profiles").select("id, full_name, email, role, marks_email").in("id", ids)
        : { data: [] };
      const personOf = new Map((people || []).map((p) => [p.id, p]));

      let sent = 0;
      let failed = 0;
      await inBatches(ids, 4, async (studentId) => {
        const person = personOf.get(studentId);
        const items = byStudent.get(studentId) || [];
        if (!person?.email || person.role !== "student" || !person.marks_email || items.length === 0) return;

        // claim these notices first: only the ones still unclaimed get emailed
        const { data: claimed } = await admin
          .from("notifications")
          .update({ emailed_at: new Date().toISOString() })
          .in("id", items.map((n) => n.id))
          .is("emailed_at", null)
          .eq("is_read", false)
          .select("id");
        const claimedIds = new Set((claimed || []).map((c) => c.id));
        const mine = items.filter((n) => claimedIds.has(n.id));
        if (mine.length === 0) return;

        try {
          await sendMarksDigestEmail({
            to: person.email,
            studentName: person.full_name || "Student",
            courses: mine.map((n) => ({
              title: n.title.replace(/^New marks in /, ""),
              assessments: n.body || "",
              enrollmentId: n.related_id,
            })),
          });
          sent++;
        } catch (err) {
          failed++;
          console.error("marks digest email failed:", err);
          // give them back so tomorrow's run can try again
          await admin.from("notifications").update({ emailed_at: null }).in("id", [...claimedIds]);
        }
      });

      summary.marks = { students: ids.length, sent, failed };
    }
  } else {
    summary.marks = "off";
  }

  // ── 2) release notes for students who haven't read them ────────
  if (process.env.RELEASE_DIGEST_EMAIL === "on") {
    const due = releasesFor("student").filter((r) => {
      const age = daysSince(r.date);
      return age >= RELEASE_MIN_DAYS && age <= RELEASE_MAX_DAYS;
    });

    if (due.length === 0) {
      summary.releases = { due: 0 };
    } else {
      // students in an active class this term
      const { data: active } = await admin
        .from("enrollments")
        .select("student_id, sections!inner ( terms!inner ( is_active ) )")
        .eq("status", "active")
        .eq("sections.terms.is_active", true);
      const studentIds = [...new Set((active || []).map((e) => e.student_id))];

      const keys = due.flatMap((r) => [`release:${r.id}`, `mail:${r.id}`]);
      const [{ data: people }, { data: seenRows }] = await Promise.all([
        studentIds.length
          ? admin.from("profiles").select("id, full_name, email").in("id", studentIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
        studentIds.length
          ? admin.from("user_seen").select("user_id, key").in("user_id", studentIds).in("key", keys)
          : Promise.resolve({ data: [] as { user_id: string; key: string }[] }),
      ]);

      const seen = new Set((seenRows || []).map((r) => `${r.user_id}|${r.key}`));
      let sent = 0;
      let failed = 0;

      await inBatches(people || [], 4, async (p) => {
        if (!p.email) return;
        const pending = due.filter((r) => !seen.has(`${p.id}|release:${r.id}`) && !seen.has(`${p.id}|mail:${r.id}`));
        if (pending.length === 0) return;
        try {
          await sendReleaseDigestEmail({
            to: p.email,
            studentName: p.full_name || "Student",
            releases: pending.map((r) => ({
              title: r.title,
              date: formatReleaseDate(r.date),
              items: r.items.map((i) => ({ kind: KIND_LABELS[i.kind], title: i.title, body: i.body })),
            })),
          });
          await admin
            .from("user_seen")
            .upsert(
              pending.map((r) => ({ user_id: p.id, key: `mail:${r.id}` })),
              { onConflict: "user_id,key", ignoreDuplicates: true }
            );
          sent++;
        } catch (err) {
          failed++;
          console.error("release digest email failed:", err);
        }
      });
      summary.releases = { due: due.map((r) => r.id), students: (people || []).length, sent, failed };
    }
  } else {
    summary.releases = "off";
  }

  console.log("daily job:", JSON.stringify(summary));
  return NextResponse.json(summary);
}
