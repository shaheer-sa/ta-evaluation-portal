import { createClient } from "@/lib/supabase/server";
import GradingClient from "./grading-client";
import type { SectionCourseRow, AssessmentRow, StudentMark } from "./grading-client";
import type { Database } from "@/types/database";

type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id"> & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "roll_number" | "full_name"> | null;
  marks: Pick<Database["public"]["Tables"]["marks"]["Row"], "assessment_id" | "score">[];
};

interface PageProps {
  searchParams: Promise<{ sc?: string; assessment?: string }>;
}

export default async function GradingPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const selectedSC = params.sc || "";
  const selectedAssessment = params.assessment || "";

  // 1. Fetch sectionCourses
  const { data: rawSections } = await supabase
    .from("section_courses")
    .select(`id, section_id, course_id, sections ( name, terms ( name ) ), courses ( code, name )`);
  const sectionCourses = (rawSections as unknown as SectionCourseRow[]) || [];

  let assessments: AssessmentRow[] = [];
  let initialStudentMarks: StudentMark[] = [];
  let maxMarks = 0;

  if (selectedSC) {
    // 2. Fetch assessments
    const { data: assessData } = await supabase
      .from("assessments")
      .select("id, title, type, max_marks")
      .eq("section_course_id", selectedSC)
      .order("created_at", { ascending: true });
    assessments = (assessData as unknown as AssessmentRow[]) || [];

    if (selectedAssessment) {
      const assessment = assessments.find((a) => a.id === selectedAssessment);
      if (assessment) {
        maxMarks = assessment.max_marks;
      }

      const sc = sectionCourses.find((s) => s.id === selectedSC);
      if (sc) {
        // 3. Fetch enrollments + marks
        const { data: rawEnrollments } = await supabase
          .from("enrollments")
          .select(`
            id,
            profiles:student_id ( roll_number, full_name ),
            marks ( assessment_id, score )
          `)
          .eq("section_id", sc.section_id)
          .eq("course_id", sc.course_id)
          .eq("status", "active");

        const enrollments = (rawEnrollments as unknown as EnrollmentRow[]) || [];
        
        initialStudentMarks = enrollments.map((e) => {
          const scoreObj = e.marks.find((m) => m.assessment_id === selectedAssessment);
          return {
            enrollmentId: e.id,
            rollNumber: e.profiles?.roll_number || "",
            fullName: e.profiles?.full_name || "",
            score:
              scoreObj && scoreObj.score !== null && scoreObj.score !== undefined
                ? String(scoreObj.score)
                : "",
          };
        });
        initialStudentMarks.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      }
    }
  }

  return (
    <GradingClient
      sectionCourses={sectionCourses}
      assessments={assessments}
      initialStudentMarks={initialStudentMarks}
      selectedSC={selectedSC}
      selectedAssessment={selectedAssessment}
      maxMarks={maxMarks}
    />
  );
}
