// "New marks" notices for students. Called after grades are saved or pulled
// from the sheet, with only the marks that are new or changed.
//
// One notice per student per class: if they already have an unread notice for
// that class that hasn't been emailed yet, the new assessment names are added
// to it instead of creating another one (so saving twice doesn't spam).
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type ChangedMark = { enrollmentId: string; assessmentId: string };

export async function notifyMarksUpdated(admin: Admin, changed: ChangedMark[]) {
  if (changed.length === 0) return;

  const enrollmentIds = [...new Set(changed.map((c) => c.enrollmentId))];
  const assessmentIds = [...new Set(changed.map((c) => c.assessmentId))];

  const [{ data: enrollments }, { data: assessments }, { data: existing }] = await Promise.all([
    admin
      .from("enrollments")
      .select("id, student_id, status, courses ( code )")
      .in("id", enrollmentIds),
    admin.from("assessments").select("id, title").in("id", assessmentIds),
    admin
      .from("notifications")
      .select("id, related_id, body")
      .eq("type", "marks_updated")
      .eq("is_read", false)
      .is("emailed_at", null)
      .in("related_id", enrollmentIds),
  ]);

  const titleOf = new Map((assessments || []).map((a) => [a.id, a.title]));
  const openNotice = new Map((existing || []).map((n) => [n.related_id as string, n]));

  // assessment titles per enrollment, in the order they came in
  const byEnrollment = new Map<string, string[]>();
  for (const c of changed) {
    const title = titleOf.get(c.assessmentId);
    if (!title) continue;
    const list = byEnrollment.get(c.enrollmentId) || [];
    if (!list.includes(title)) list.push(title);
    byEnrollment.set(c.enrollmentId, list);
  }

  const inserts: {
    recipient_id: string;
    type: string;
    title: string;
    body: string;
    related_id: string;
  }[] = [];
  const updates: PromiseLike<unknown>[] = [];

  for (const e of (enrollments || []) as unknown as {
    id: string;
    student_id: string;
    status: string;
    courses: { code: string } | null;
  }[]) {
    if (e.status !== "active") continue;
    const titles = byEnrollment.get(e.id);
    if (!titles || titles.length === 0) continue;
    const code = e.courses?.code || "your course";

    const prev = openNotice.get(e.id);
    if (prev) {
      const merged = [...new Set([...(prev.body || "").split(", ").filter(Boolean), ...titles])];
      updates.push(
        admin
          .from("notifications")
          .update({ body: merged.join(", "), created_at: new Date().toISOString() })
          .eq("id", prev.id)
      );
    } else {
      inserts.push({
        recipient_id: e.student_id,
        type: "marks_updated",
        title: `New marks in ${code}`,
        body: titles.join(", "),
        related_id: e.id,
      });
    }
  }

  if (inserts.length > 0) {
    const { error } = await admin.from("notifications").insert(inserts);
    if (error) console.error("marks notice insert failed:", error.code, error.message);
  }
  await Promise.allSettled(updates);
}
