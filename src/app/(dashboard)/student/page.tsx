import { createClient } from "@/lib/supabase/server";
import { StatStrip, GradeCard, CourseGrade, GradesGrid } from "@/components/student/GradesOverview";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { Database } from "@/types/database";

type EnrollmentRow = {
  id: string;
  course_id: string;
  section_id: string;
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "id" | "code" | "name"> | null;
  sections: (Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> & {
    terms: Pick<Database["public"]["Tables"]["terms"]["Row"], "name"> | null;
  }) | null;
  marks: (Pick<Database["public"]["Tables"]["marks"]["Row"], "score"> & {
    assessments: Pick<Database["public"]["Tables"]["assessments"]["Row"], "title" | "max_marks" | "weight"> | null;
  })[];
};

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, roll_number")
    .eq("id", user.id)
    .single();

  // Fetch pending queries for the student
  const { count: pendingQueries } = await supabase
    .from("queries")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user.id)
    .eq("status", "pending");

  // Fetch the student's enrollments with courses and marks
  const { data: rawEnrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      course_id,
      section_id,
      courses:course_id ( id, code, name ),
      sections:section_id ( name, terms:term_id ( name ) ),
      marks ( score, assessments:assessment_id ( title, max_marks, weight ) )
    `)
    .eq("student_id", user.id);

  const enrollments = rawEnrollments as unknown as EnrollmentRow[] | null;

  // Calculate weighted percentage per enrollment
  const courseCards: CourseGrade[] = (enrollments || []).map((e) => {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    const breakdown: { label: string; score: number; max: number; weight: number }[] = [];
    let gradedCount = 0;

    for (const m of e.marks) {
      const assessment = m.assessments;
      if (
        assessment &&
        assessment.max_marks > 0 &&
        m.score !== null &&
        m.score !== undefined
      ) {
        gradedCount++;
        const pct = Number(m.score) / assessment.max_marks;
        if (Number.isFinite(pct)) {
          totalWeightedScore += pct * assessment.weight;
          totalWeight += assessment.weight;
        }
        
        breakdown.push({
          label: assessment.title || "Assessment",
          score: Number(m.score),
          max: assessment.max_marks,
          weight: assessment.weight,
        });
      }
    }

    const weightedPct = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
    
    // Sort breakdown by weight (highest first) and take top 3
    breakdown.sort((a, b) => b.weight - a.weight);
    const topBreakdown = breakdown.slice(0, 3).map(b => ({
      label: b.label,
      score: b.score,
      max: b.max,
    }));

    return {
      id: e.id,
      code: e.courses?.code || "",
      title: e.courses?.name || "",
      section: e.sections?.name || "",
      term: e.sections?.terms?.name || "",
      gradedCount,
      totalCount: e.marks.length,
      percentage: Math.round(weightedPct * 10) / 10,
      weightCovered: Math.round(totalWeight * 10) / 10,
      breakdown: topBreakdown,
    };
  });

  const overall = courseCards.length > 0 
    ? courseCards.reduce((sum, c) => sum + c.percentage, 0) / courseCards.length
    : 0;

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">STUDENT</p>
          <h1 className="tams-pagehead__title">My Grades</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          Welcome back, {profile?.full_name || "Student"} ({profile?.roll_number}).
        </p>
      </div>

      <GradesGrid>
        <StatStrip
          overall={courseCards.length > 0 ? `${overall.toFixed(1)}%` : "—"}
          courseCount={courseCards.length}
          pendingQueries={pendingQueries || 0}
        />

        {courseCards.length === 0 ? (
          <Card data-edge className="border-none bg-white/[0.03] backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                You are not enrolled in any courses yet. Your TA will add you once the semester begins.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courseCards.map((c) => (
              <GradeCard key={c.code} course={c} />
            ))}
          </div>
        )}
      </GradesGrid>
    </div>
  );
}
