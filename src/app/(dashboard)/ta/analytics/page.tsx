import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SectionPicker } from "./section-picker";

export default async function AnalyticsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const searchParams = await props.searchParams;
  const scId = typeof searchParams.sc === "string" ? searchParams.sc : "";

  const { data: activeTerm } = await supabase
    .from("terms")
    .select("id, name")
    .eq("is_active", true)
    .single();

  if (!activeTerm) {
    return (
      <div className="space-y-8">
        <div className="tams-pagehead">
          <div>
            <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
            <h1 className="tams-pagehead__title">Analytics</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No active term found. Create and activate a term to see analytics.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get active sections
  const { data: sections } = await supabase
    .from("sections")
    .select("id, name, section_courses(id, courses(code))")
    .eq("term_id", activeTerm.id);

  if (!sections || sections.length === 0) {
    return (
      <div className="space-y-8">
        <div className="tams-pagehead">
          <div>
            <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
            <h1 className="tams-pagehead__title">Analytics ({activeTerm.name})</h1>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No sections found in the active term.
          </CardContent>
        </Card>
      </div>
    );
  }

  const options: { id: string; label: string }[] = [];
  sections.forEach((sec) => {
    sec.section_courses?.forEach((sc: { id: string; courses: { code: string } | null } | null) => {
      if (sc && sc.courses?.code) {
        options.push({
          id: sc.id,
          label: `${sec.name} — ${sc.courses.code}`,
        });
      }
    });
  });
  
  if (!scId) {
    return (
      <div className="space-y-8">
        <div className="tams-pagehead">
          <div>
            <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
            <h1 className="tams-pagehead__title">Analytics</h1>
          </div>
          <p className="text-sm text-muted-foreground text-right hidden sm:block">
            Performance metrics and trends for {activeTerm.name}.
          </p>
        </div>
        <SectionPicker options={options} />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a section to view performance
          </CardContent>
        </Card>
      </div>
    );
  }

  // STEP 2 — Once ?sc is set, fetch for that section_course:
  const { data: sectionCourse } = await supabase
    .from("section_courses")
    .select("section_id, course_id")
    .eq("id", scId)
    .single();

  if (!sectionCourse) {
    return <div>Invalid section course.</div>;
  }

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, profiles(full_name, roll_number)")
    .eq("section_id", sectionCourse.section_id)
    .eq("course_id", sectionCourse.course_id)
    .eq("status", "active");

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, title, max_marks, weight")
    .eq("section_course_id", scId);

  const enrollmentIds = enrollments?.map((e) => e.id) || [];
  const assessmentIds = assessments?.map((a) => a.id) || [];

  const { data: marks } = await supabase
    .from("marks")
    .select("enrollment_id, assessment_id, score")
    .in("enrollment_id", enrollmentIds)
    .in("assessment_id", assessmentIds);

  // STEP 3 — Compute per student
  type StudentPerformance = {
    enrollmentId: string;
    rollNumber: string;
    fullName: string;
    obtainedWeight: number;
    totalWeight: number;
    percentage: number | null;
    gradedCount: number;
  };

  const performance: StudentPerformance[] = [];

  enrollments?.forEach((e) => {
    let obtained = 0;
    let total = 0;
    let graded = 0;

    const studentMarks = marks?.filter(m => m.enrollment_id === e.id) || [];
    
    studentMarks.forEach(m => {
      if (m.score === null || m.score === undefined) return;
      
      const score = Number(m.score);
      const assessment = assessments?.find(a => a.id === m.assessment_id);
      
      if (assessment && assessment.max_marks && assessment.max_marks > 0 && !isNaN(score)) {
        obtained += (score / assessment.max_marks) * (assessment.weight || 0);
        total += (assessment.weight || 0);
        graded += 1;
      }
    });

    performance.push({
      enrollmentId: e.id,
      rollNumber: (e.profiles as { roll_number: string } | null)?.roll_number || "—",
      fullName: (e.profiles as { full_name: string } | null)?.full_name || "Unknown",
      obtainedWeight: obtained,
      totalWeight: total,
      percentage: total > 0 ? (obtained / total) * 100 : null,
      gradedCount: graded,
    });
  });

  // Sort by percentage descending, ungraded students last.
  performance.sort((a, b) => {
    if (a.percentage === null && b.percentage !== null) return 1;
    if (b.percentage === null && a.percentage !== null) return -1;
    if (a.percentage !== null && b.percentage !== null) return b.percentage - a.percentage;
    return 0;
  });

  const top3 = performance.filter(p => p.percentage !== null).slice(0, 3);
  const ranks = ["1ST", "2ND", "3RD"];

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Analytics</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block">
          Performance metrics and trends for {activeTerm.name}.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <SectionPicker options={options} />
      </div>

      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {top3.map((p, i) => (
            <div key={p.enrollmentId} className="tams-stat" data-cat="count">
              <div className="tams-stat__header">
                <span className="tams-stat__label">{ranks[i]}</span>
              </div>
              <div className="tams-stat__value">{p.percentage?.toFixed(1)}%</div>
              <div className="tams-stat__meta">{p.fullName}</div>
            </div>
          ))}
        </div>
      )}

      <Card data-edge>
        <CardContent>
        <div className="tams-table-wrap">
          <table className="tams-table">
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Student</th>
                <th className="tams-numeral">Graded</th>
                <th className="tams-numeral">Weight Obtained</th>
                <th className="tams-numeral">Total Weight</th>
                <th className="tams-numeral">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {performance.map(p => (
                <tr key={p.enrollmentId} className="transition-colors">
                  <td>{p.rollNumber}</td>
                  <td>{p.fullName}</td>
                  <td className="tams-numeral">
                    {p.gradedCount === 0 ? "—" : p.gradedCount}
                  </td>
                  <td className="tams-numeral">
                    {p.gradedCount === 0 ? "—" : p.obtainedWeight.toFixed(2)}
                  </td>
                  <td className="tams-numeral">
                    {p.gradedCount === 0 ? "—" : p.totalWeight.toFixed(2)}
                  </td>
                  <td className="tams-numeral">
                    {p.percentage === null ? "—" : `${p.percentage.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
