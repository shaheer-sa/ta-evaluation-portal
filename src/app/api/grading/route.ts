import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { assessmentId, marks } = await request.json();

    if (!assessmentId || !Array.isArray(marks)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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

    if (rows.length === 0) {
      return NextResponse.json({ success: true, saved: 0 });
    }

    // -- Single batched upsert ---------------------------------------
    // Replaces the previous per-student SELECT-then-INSERT/UPDATE loop,
    // which issued 2 round trips per student (400 for a 200-seat section)
    // and raced against itself if two tabs saved at once.
    // Requires a unique constraint on (enrollment_id, assessment_id) --
    // see supabase/schema.sql.
    const { error: upsertError, count } = await supabase
      .from("marks")
      .upsert(
        rows.map((r) => ({
          enrollment_id: r.enrollment_id,
          assessment_id: assessmentId,
          score: r.score,
          updated_by: user.id,
        })),
        { onConflict: "enrollment_id,assessment_id", count: "exact" }
      );

    // The old version discarded this error and returned success anyway, so
    // the TA saw "Marks saved successfully!" while nothing had been written.
    if (upsertError) {
      console.error("Grading upsert failed:", upsertError);
      return NextResponse.json(
        { error: `Couldn't save marks: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, saved: count ?? rows.length });
  } catch (err: unknown) {
    console.error("Grading error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
