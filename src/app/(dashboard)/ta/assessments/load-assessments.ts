import { createClient } from "@/lib/supabase/server";
import type { AssessmentItem, SectionCourseInfo } from "./group-assessments";

// shared by the assessments page and the "all assessments" page
export async function loadAssessmentsData() {
  const supabase = await createClient();

  const [{ data: sectionCourses }, { data: assessments }] = await Promise.all([
    supabase.from("section_courses").select(`
      id,
      best_of_quizzes,
      best_of_assignments,
      quiz_total_weight,
      assignment_total_weight,
      sections ( name, terms ( name, is_active ) ),
      courses ( code, name, enable_cp, enable_assignments, enable_quizzes )
    `),
    supabase
      .from("assessments")
      .select(`
        id,
        section_course_id,
        type,
        title,
        max_marks,
        weight,
        created_at,
        section_courses (
          id,
          best_of_quizzes,
          best_of_assignments,
          quiz_total_weight,
          assignment_total_weight,
          sections ( name, terms ( name, is_active ) ),
          courses ( code, name, enable_cp, enable_assignments, enable_quizzes )
        )
      `)
      .order("created_at", { ascending: true }),
  ]);

  return {
    sectionCourses: (sectionCourses || []) as unknown as SectionCourseInfo[],
    assessments: (assessments || []) as unknown as AssessmentItem[],
  };
}
