import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    if (
      !assessmentId ||
      !marks ||
      !Array.isArray(marks)
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Process each mark individually — check if exists, then update or insert
    for (const m of marks) {
      if (m.score === null || m.score === undefined || m.score === "") continue;

      const score = parseFloat(m.score);
      if (isNaN(score)) continue;

      const { data: existing } = await supabase
        .from("marks")
        .select("id")
        .eq("enrollment_id", m.enrollmentId)
        .eq("assessment_id", assessmentId)
        .single();

      if (existing) {
        await supabase
          .from("marks")
          .update({ score, updated_by: user.id })
          .eq("id", existing.id);
      } else {
        await supabase.from("marks").insert({
          enrollment_id: m.enrollmentId,
          assessment_id: assessmentId,
          score,
          updated_by: user.id,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Grading error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
