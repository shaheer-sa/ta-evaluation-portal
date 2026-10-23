import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter } from "@/lib/rate-limit";

const gradingRateLimit = createRateLimiter({ tokens: 60, window: "10 m" });

const gradingPostSchema = z.object({
  assessmentId: z.string().uuid("Invalid assessment ID."),
  marks: z
    .array(
      z.object({
        enrollmentId: z.string().uuid("Invalid enrollment ID."),
        score: z.union([z.string(), z.number(), z.null()]).optional(),
      })
    )
    .max(1000, "Cannot submit more than 1000 marks at once."),
  clearEnrollmentIds: z
    .array(z.string().uuid("Invalid clear enrollment ID."))
    .max(1000, "Cannot clear more than 1000 marks at once.")
    .optional(),
});

interface IncomingMark {
  enrollmentId?: string;
  score?: string | number | null;
}

/**
 * POST /api/grading
 * Bulk upsert marks for an assessment.
 * Body: { assessmentId, marks: [{ enrollmentId, score }] }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "ta") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (gradingRateLimit) {
      const { success, reset } = await gradingRateLimit.limit(`grading:${user.id}`);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: "You're doing that too often. Please wait a few minutes and try again." },
          {
            status: 429,
            headers: { "Retry-After": retryAfter.toString() },
          }
        );
      }
    }

    const body = await request.json();
    const parsed = gradingPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid grading payload." },
        { status: 400 }
      );
    }
    const { assessmentId, marks, clearEnrollmentIds } = parsed.data;

    if (clearEnrollmentIds !== undefined) {
      const clearSet = new Set(clearEnrollmentIds);
      for (const m of marks as IncomingMark[]) {
        if (m.enrollmentId && clearSet.has(m.enrollmentId)) {
          return NextResponse.json(
            { error: "Cannot submit a mark and clear it in the same request" },
            { status: 400 }
          );
        }
      }
    }

    // Look up the assessment so scores can be validated against its ceiling.
    // Without this a typo could store 850 on a 50-mark quiz and quietly wreck
    // every weighted average that depends on it.
    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .select("id, max_marks")
      .eq("id", assessmentId)
      .single();

    if (assessmentError || !assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const maxMarks = Number(assessment.max_marks);

    // -- Validate everything up front --------------------------------
    // All-or-nothing: a partially applied grade sheet is worse than a
    // rejected one, because the TA has no way to tell which rows landed.
    const rows: { enrollment_id: string; score: number }[] = [];
    const rejected: { enrollmentId: string; reason: string }[] = [];

    for (const m of marks as IncomingMark[]) {
      if (!m?.enrollmentId) continue;

      // Empty means "not graded yet" -- skip rather than writing a zero.
      if (m.score === null || m.score === undefined || m.score === "") continue;

      const score = Number(m.score);

      if (!Number.isFinite(score)) {
        rejected.push({ enrollmentId: m.enrollmentId, reason: "not a number" });
        continue;
      }
      if (score < 0) {
        rejected.push({ enrollmentId: m.enrollmentId, reason: "negative" });
        continue;
      }
      if (maxMarks > 0 && score > maxMarks) {
        rejected.push({
          enrollmentId: m.enrollmentId,
          reason: `above the maximum of ${maxMarks}`,
        });
        continue;
      }

      rows.push({ enrollment_id: m.enrollmentId, score });
    }

    if (rejected.length > 0) {
      return NextResponse.json(
        {
          error: `${rejected.length} score${rejected.length === 1 ? " is" : "s are"} invalid. Nothing was saved.`,
          rejected,
        },
        { status: 400 }
      );
    }

    if (rows.length === 0 && (!clearEnrollmentIds || clearEnrollmentIds.length === 0)) {
      return NextResponse.json({ success: true, saved: 0 });
    }

    // -- Single batched upsert ---------------------------------------
    // Replaces the previous per-student SELECT-then-INSERT/UPDATE loop,
    // which issued 2 round trips per student (400 for a 200-seat section)
    // and raced against itself if two tabs saved at once.
    // Requires a unique constraint on (enrollment_id, assessment_id) --
    // see supabase/schema.sql.
    const deduped = Array.from(
      new Map(rows.map((r) => [r.enrollment_id, r])).values()
    );

    let savedCount = 0;
    if (rows.length > 0) {
      const { error: upsertError, count } = await supabase
        .from("marks")
        .upsert(
          deduped.map((r) => ({
            enrollment_id: r.enrollment_id,
            assessment_id: assessmentId,
            score: r.score,
            updated_by: user.id,
          })),
          { onConflict: "enrollment_id,assessment_id", count: "exact" }
        );

      if (upsertError) {
        console.error("Grading upsert failed:", upsertError);
        return NextResponse.json(
          { error: "Couldn't save marks. Please try again." },
          { status: 500 }
        );
      }
      savedCount = count ?? rows.length;
    }

    if (clearEnrollmentIds && clearEnrollmentIds.length > 0) {
      const { error: delError } = await supabase
        .from("marks")
        .update({ score: null, updated_by: user.id })
        .eq("assessment_id", assessmentId)
        .in("enrollment_id", clearEnrollmentIds);

      if (delError) {
        console.error("Failed to clear marks:", delError);
        return NextResponse.json({ error: "Couldn't remove those marks." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, saved: savedCount });
  } catch (err: unknown) {
    console.error("Grading error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
