import { createClient } from "@/lib/supabase/server";
import { StudentPerformanceSelector } from "./student-performance-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StudentPerformanceProps {
  termId: string;
  sectionCourseId?: string;
}

export async function StudentPerformance({ termId, sectionCourseId }: StudentPerformanceProps) {
  const supabase = await createClient();

  // 1. Fetch available sections for this term
  const { data: sectionCoursesData } = await supabase
    .from("section_courses")
    .select(`
      id,
      sections!inner ( id, term_id, name ),
      courses!inner ( id, code, name )
    `)
    .eq("sections.term_id", termId);

  // Map to a cleaner format for the selector
  const availableSections = (sectionCoursesData || []).map((sc) => ({
    id: sc.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: `${(sc.courses as any).code} - ${(sc.sections as any).name}`,
  }));

  const selectedSc = sectionCoursesData?.find((sc) => sc.id === sectionCourseId);
  
  let tableData = null;

  if (selectedSc) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectionId = (selectedSc.sections as any).id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseId = (selectedSc.courses as any).id;

    // Fetch enrollments
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(`
        id,
        profiles ( full_name, roll_number )
      `)
      .eq("section_id", sectionId)
      .eq("course_id", courseId);

    // Fetch assessments
    const { data: assessments } = await supabase
      .from("assessments")
      .select("id, max_marks, weight")
      .eq("section_course_id", sectionCourseId);

    const enrollmentIds = enrollments?.map((e) => e.id) || [];
    const assessmentIds = assessments?.map((a) => a.id) || [];

    // Fetch marks
    let marks: any[] = [];
    if (enrollmentIds.length > 0 && assessmentIds.length > 0) {
      const { data: fetchedMarks } = await supabase
        .from("marks")
        .select("score, assessment_id, enrollment_id")
        .in("enrollment_id", enrollmentIds)
        .in("assessment_id", assessmentIds);
      marks = fetchedMarks || [];
    }

    // Process data per student
    tableData = enrollments?.map((enrollment) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = enrollment.profiles as any;
      const studentMarks = marks.filter((m) => m.enrollment_id === enrollment.id);

      let totalMaxMarks = 0;
      let totalObtainedMarks = 0;
      let totalAbsoluteWeight = 0;
      let totalObtainedAbsolutes = 0;

      assessments?.forEach((assessment) => {
        const mark = studentMarks.find((m) => m.assessment_id === assessment.id);
        
        // Skip ungraded assessments (null or undefined score)
        if (mark && mark.score !== null && mark.score !== undefined) {
          const maxMarks = Number(assessment.max_marks);
          const weight = Number(assessment.weight);
          const score = Number(mark.score);

          if (maxMarks > 0) {
            totalMaxMarks += maxMarks;
            totalObtainedMarks += score;
            totalAbsoluteWeight += weight;
            totalObtainedAbsolutes += (score / maxMarks) * weight;
          }
        }
      });

      return {
        id: enrollment.id,
        rollNumber: profile?.roll_number || "Unknown",
        fullName: profile?.full_name || "Unknown",
        totalObtainedMarks,
        totalMaxMarks,
        totalObtainedAbsolutes,
        totalAbsoluteWeight,
      };
    }) || [];

    // Sort alphabetically by roll number
    tableData.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

    // Calculate Class Average
    let totalClassAbsolutes = 0;
    tableData.forEach(student => {
      totalClassAbsolutes += student.totalObtainedAbsolutes;
    });
    const classAvgAbsolute = tableData.length > 0 ? totalClassAbsolutes / tableData.length : 0;
    
    // Attach class avg to tableData items for ease of rendering
    tableData = tableData.map(student => ({
      ...student,
      classAvgAbsolute
    }));
  }

  return (
    <Card className="mc-card mc-card--glow" style={{ "--mc-glow": "250, 163, 10" } as any}>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-semibold">Student Performance</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Detailed view of raw marks and calculated absolutes.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <StudentPerformanceSelector 
            sections={availableSections} 
            selectedId={sectionCourseId} 
          />
        </div>
      </CardHeader>
      <CardContent>
        {!selectedSc ? (
          <div className="py-12 text-center text-muted-foreground border rounded-lg bg-black/20">
            Please select a section to view student performance.
          </div>
        ) : tableData?.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border rounded-lg bg-black/20">
            No students enrolled in this section yet.
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium border-b">Roll Number</th>
                    <th className="px-4 py-3 font-medium border-b">Full Name</th>
                    <th className="px-4 py-3 font-medium border-b text-right">Class Avg</th>
                    <th className="px-4 py-3 font-medium border-b text-right">Absolutes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tableData?.map((student) => {
                    const rawPct = student.totalMaxMarks > 0 
                      ? Math.round((student.totalObtainedMarks / student.totalMaxMarks) * 100)
                      : 0;
                    
                    return (
                      <tr key={student.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium">{student.rollNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">{student.fullName}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-foreground">
                            {Number(student.classAvgAbsolute.toFixed(2))}
                          </span>
                          <span className="text-muted-foreground"> / {student.totalAbsoluteWeight}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-primary">
                            {Number(student.totalObtainedAbsolutes.toFixed(2))}
                          </span>
                          <span className="text-muted-foreground"> / {student.totalAbsoluteWeight}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
