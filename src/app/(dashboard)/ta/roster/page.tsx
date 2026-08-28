import { createClient } from "@/lib/supabase/server";
import RosterClient from "./roster-client";
import type { SectionCourseRow, EnrollmentRow, AssessmentRow } from "./roster-client";

interface PageProps {
  searchParams: Promise<{ sc?: string }>;
}

export default async function RosterPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const selectedSectionCourseId = params.sc || "";

  // 1. Fetch all mapped sections
  const { data: rawSections } = await supabase
    .from("section_courses")
    .select(`
      id,
      section_id,
      course_id,
      sections ( name, terms ( name ) ),
      courses ( code, name )
    `);
  
  const sections = (rawSections as unknown as SectionCourseRow[]) || [];

  let roster: EnrollmentRow[] = [];
  let assessments: AssessmentRow[] = [];

  if (selectedSectionCourseId) {
    const mapped = sections.find((s) => s.id === selectedSectionCourseId);
    
    if (mapped) {
      // 2. Fetch assessments for this section_course
      const { data: assessData } = await supabase
        .from("assessments")
        .select("id, title, max_marks")
        .eq("section_course_id", selectedSectionCourseId)
        .order("created_at", { ascending: true });
      
      assessments = (assessData as unknown as AssessmentRow[]) || [];

      // 3. Fetch enrollments with marks
      const { data: rosterData } = await supabase
        .from("enrollments")
        .select(`
          id,
          status,
          profiles:student_id ( id, roll_number, full_name, email, must_change_password ),
          marks ( assessment_id, score )
        `)
        .eq("section_id", mapped.section_id)
        .eq("course_id", mapped.course_id);

      roster = (rosterData as unknown as EnrollmentRow[]) || [];
    }
  }

  return (
    <RosterClient
      sections={sections}
      selectedSectionCourseId={selectedSectionCourseId}
      roster={roster}
      assessments={assessments}
    />
  );
}
