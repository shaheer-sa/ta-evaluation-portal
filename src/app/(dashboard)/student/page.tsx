import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  // Fetch the student's enrollments with courses and marks
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      course_id,
      section_id,
      courses:course_id ( id, code, name ),
      sections:section_id ( name, terms:term_id ( name ) ),
      marks ( score, assessments:assessment_id ( max_marks, weight ) )
    `)
    .eq("student_id", user.id);

  // Calculate weighted percentage per enrollment
  const courseCards = (enrollments || []).map((e) => {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const m of e.marks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assessment = m.assessments as any;
      if (assessment && assessment.max_marks > 0) {
        const pct = m.score / assessment.max_marks;
        totalWeightedScore += pct * assessment.weight;
        totalWeight += assessment.weight;
      }
    }

    const weightedPct = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;

    return {
      enrollmentId: e.id,
      courseId: e.course_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      courseCode: (e.courses as any)?.code || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      courseName: (e.courses as any)?.name || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sectionName: (e.sections as any)?.name || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      termName: (e.sections as any)?.terms?.name || "",
      marksCount: e.marks.length,
      weightedPct: Math.round(weightedPct * 10) / 10,
      totalWeight: Math.round(totalWeight * 10) / 10,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Grades</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.full_name || "Student"} ({profile?.roll_number}).
        </p>
      </div>

      {courseCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              You are not enrolled in any courses yet. Your TA will add you once the semester begins.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courseCards.map((c) => (
            <Link key={c.enrollmentId} href={`/student/course/${c.enrollmentId}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{c.courseCode}</CardTitle>
                  <CardDescription>{c.courseName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {c.termName} · Section {c.sectionName}
                  </p>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Weighted Score</span>
                      <span className="font-semibold">
                        {c.marksCount > 0 ? `${c.weightedPct}%` : "—"}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(c.weightedPct, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">
                      {c.marksCount} graded · {c.totalWeight}% weight covered
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
