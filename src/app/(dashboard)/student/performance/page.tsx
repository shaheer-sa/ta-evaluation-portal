import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2 } from "lucide-react";

export default async function StudentPerformancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // 1. Get student's enrollments with course/section info
  const { data: myEnrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      section_id,
      course_id,
      student_id,
      courses ( code, name ),
      sections ( name, term_id, terms ( name, is_active ) )
    `)
    .eq("student_id", user.id);

  // Filter only active terms for performance analytics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeEnrollments = (myEnrollments || []).filter(e => (e.sections as any)?.terms?.is_active);

  if (!activeEnrollments || activeEnrollments.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Performance Analytics</h1>
          <p className="text-muted-foreground">Compare your absolute scores against the class average.</p>
        </div>
        <Card className="border-none bg-white/[0.03] backdrop-blur-xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            No active courses found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sectionIds = activeEnrollments.map((e) => e.section_id);
  const courseIds = activeEnrollments.map((e) => e.course_id);
  const validCombos = new Set(activeEnrollments.map((e) => `${e.section_id}-${e.course_id}`));

  // 2. Fetch section_courses to link assessments
  const { data: sectionCourses } = await supabase
    .from("section_courses")
    .select("id, section_id, course_id")
    .in("section_id", sectionIds)
    .in("course_id", courseIds);

  const relevantSc = (sectionCourses || []).filter(sc => validCombos.has(`${sc.section_id}-${sc.course_id}`));
  const relevantScIds = relevantSc.map(sc => sc.id);

  // 3. Fetch ALL enrollments for these classes (to calculate class averages)
  const { data: classEnrollments } = await supabase
    .from("enrollments")
    .select("id, section_id, course_id, student_id")
    .in("section_id", sectionIds)
    .in("course_id", courseIds);

  const relevantClassEnrollments = (classEnrollments || []).filter(e => validCombos.has(`${e.section_id}-${e.course_id}`));
  const relevantClassEnrollmentIds = relevantClassEnrollments.map(e => e.id);

  // 4. Fetch all assessments for these section_courses
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id, section_course_id, max_marks, weight")
    .in("section_course_id", relevantScIds);

  const assessmentIds = (assessments || []).map(a => a.id);

  // 5. Fetch all marks
  let allMarks: any[] = [];
  if (relevantClassEnrollmentIds.length > 0 && assessmentIds.length > 0) {
    const { data: fetchedMarks } = await supabase
      .from("marks")
      .select("score, assessment_id, enrollment_id")
      .in("enrollment_id", relevantClassEnrollmentIds)
      .in("assessment_id", assessmentIds);
    allMarks = fetchedMarks || [];
  }

  // 6. Compute metrics per course combo
  const tableData = activeEnrollments.map(myEnrollment => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const course = myEnrollment.courses as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const section = myEnrollment.sections as any;

    const sc = relevantSc.find(s => s.section_id === myEnrollment.section_id && s.course_id === myEnrollment.course_id);
    const courseAssessments = (assessments || []).filter(a => a.section_course_id === sc?.id);

    // Get all students in this class
    const classmates = relevantClassEnrollments.filter(e => e.section_id === myEnrollment.section_id && e.course_id === myEnrollment.course_id);
    
    let totalClassAbsolutes = 0;
    let myTotalAbsolutes = 0;
    let maxAbsoluteWeight = 0;

    classmates.forEach(classmate => {
      const classmateMarks = allMarks.filter(m => m.enrollment_id === classmate.id);
      
      let studentTotalAbsolutes = 0;
      let studentMaxWeight = 0; // to keep track of graded max weight

      courseAssessments.forEach(assessment => {
        const mark = classmateMarks.find(m => m.assessment_id === assessment.id);
        if (mark && mark.score !== null && mark.score !== undefined) {
          const max = Number(assessment.max_marks);
          const weight = Number(assessment.weight);
          const score = Number(mark.score);
          if (max > 0) {
            studentTotalAbsolutes += (score / max) * weight;
            studentMaxWeight += weight;
          }
        }
      });

      totalClassAbsolutes += studentTotalAbsolutes;

      if (classmate.student_id === user.id) {
        myTotalAbsolutes = studentTotalAbsolutes;
        maxAbsoluteWeight = studentMaxWeight;
      }
    });

    const classAverage = classmates.length > 0 ? totalClassAbsolutes / classmates.length : 0;

    return {
      id: myEnrollment.id,
      courseCode: course.code,
      courseName: course.name,
      sectionName: section.name,
      termName: section.terms?.name,
      myAbsolutes: myTotalAbsolutes,
      classAverage,
      maxAbsoluteWeight
    };
  });

  return (
    <div className="max-w-[1200px] mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Performance Analytics</h1>
        <p className="text-muted-foreground">Compare your absolute scores against the class average.</p>
      </div>

      <Card className="mc-card mc-card--glow" style={{ "--mc-glow": "250, 163, 10" } as any}>
        <CardHeader className="flex flex-row items-center gap-2 border-b border-white/5 pb-4">
          <BarChart2 className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Your Performance vs Class Average</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-0 sm:px-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium border-b border-white/10">Course Code</th>
                  <th className="px-6 py-4 font-medium border-b border-white/10">Course Name</th>
                  <th className="px-6 py-4 font-medium border-b border-white/10 text-right">Class Average</th>
                  <th className="px-6 py-4 font-medium border-b border-white/10 text-right">My Absolutes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tableData.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium">{row.courseCode}</td>
                    <td className="px-6 py-4 text-muted-foreground">{row.courseName}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-foreground">
                        {Number(row.classAverage.toFixed(2))}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        / {row.maxAbsoluteWeight}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-primary">
                        {Number(row.myAbsolutes.toFixed(2))}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        / {row.maxAbsoluteWeight}
                      </span>
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
