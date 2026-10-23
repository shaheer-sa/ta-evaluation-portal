import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RosterClient from "./roster-client";
import type { SectionCourseRow, EnrollmentRow, AssessmentRow } from "./roster-client";
import { sortAssessments } from "@/lib/assessment-order";

interface PageProps {
  searchParams: Promise<{ sc?: string; student?: string; q?: string }>;
}

export default async function RosterPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const selectedSectionCourseId = params.sc || "";
  const studentParam = params.student || "";
  const queryParam = params.q || "";

  // 1. Fetch all mapped sections
  const { data: rawSections } = await supabase
    .from("section_courses")
    .select(`
      id,
      section_id,
      course_id,
      sections ( name, terms ( name, is_active ) ),
      courses ( code, name )
    `);
  
  const sections = (rawSections as unknown as SectionCourseRow[]) || [];

  let studentNotFound = false;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentParam);

  if (isUuid && !selectedSectionCourseId) {
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("roll_number")
      .eq("id", studentParam)
      .maybeSingle();

    const { data: rawEnrollments } = await supabase
      .from("enrollments")
      .select(`
        section_id,
        course_id,
        status,
        sections ( terms ( is_active ) )
      `)
      .eq("student_id", studentParam);

    type StudentEnrollment = {
      section_id: string;
      course_id: string;
      status: string;
      sections: {
        terms: {
          is_active: boolean;
        } | null;
      } | null;
    };

    const activeEnrollments = ((rawEnrollments as unknown as StudentEnrollment[]) || []).filter(
      (e) => e.status === "active"
    );

    const preferred =
      activeEnrollments.find((e) => e.sections?.terms?.is_active) ||
      activeEnrollments[0];

    if (preferred && studentProfile?.roll_number) {
      const matchingSC = sections.find(
        (sc) => sc.section_id === preferred.section_id && sc.course_id === preferred.course_id
      );
      if (matchingSC) {
        redirect(`/ta/roster?sc=${matchingSC.id}&q=${encodeURIComponent(studentProfile.roll_number)}`);
      }
    }

    studentNotFound = true;
  }

  let roster: EnrollmentRow[] = [];
  let assessments: AssessmentRow[] = [];

  if (selectedSectionCourseId) {
    const mapped = sections.find((s) => s.id === selectedSectionCourseId);
    
    if (mapped) {
      // 2. Fetch assessments for this section_course
      const { data: assessData } = await supabase
        .from("assessments")
        .select("id, title, max_marks, type, created_at")
        .eq("section_course_id", selectedSectionCourseId)
        .order("created_at", { ascending: true });
      
      assessments = sortAssessments((assessData as unknown as AssessmentRow[]) || []);

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
      studentNotFound={studentNotFound}
      initialSearch={queryParam}
    />
  );
}
