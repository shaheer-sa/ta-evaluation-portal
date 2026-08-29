import { createClient } from "@/lib/supabase/server";
import StudentQueriesClient from "./client-page";
import type { EnrollmentRow, AssessmentRow } from "./client-page";

interface PageProps {
  searchParams: Promise<{ enrollment?: string }>;
}

export default async function StudentQueriesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const params = await searchParams;
  const selectedEnrollment = params.enrollment || "";

  const { data: rawQueries } = await supabase
    .from("queries")
    .select(`
      id,
      title,
      description,
      priority,
      status,
      created_at,
      assessments:assessment_id ( title )
    `)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const { data: rawEnrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      section_id,
      course_id,
      courses ( code, name ),
      sections ( name )
    `)
    .eq("student_id", user.id);
  
  const enrollments = (rawEnrollments as unknown as EnrollmentRow[]) || [];

  let assessments: AssessmentRow[] = [];
  
  if (selectedEnrollment) {
    const enrollment = enrollments.find(e => e.id === selectedEnrollment);
    if (enrollment) {
      const { data: sc } = await supabase
        .from("section_courses")
        .select("id")
        .eq("section_id", enrollment.section_id || "")
        .eq("course_id", enrollment.course_id || "")
        .single();
      
      if (sc) {
        const { data: assessData } = await supabase
          .from("assessments")
          .select("id, title, type")
          .eq("section_course_id", sc.id)
          .order("created_at", { ascending: true });
        
        assessments = (assessData as unknown as AssessmentRow[]) || [];
      }
    }
  }

  return (
    <StudentQueriesClient 
      initialQueries={(rawQueries as unknown as React.ComponentProps<typeof StudentQueriesClient>["initialQueries"]) || []}
      enrollments={enrollments}
      assessments={assessments}
      selectedEnrollment={selectedEnrollment}
    />
  );
}
