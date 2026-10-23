import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateAssessmentForm } from "./create-assessment-form";
import { AssessmentsList } from "./assessments-list";

export default async function AssessmentsPage() {
  const supabase = await createClient();

  // Fetch section-courses for dropdown
  const { data } = await supabase
    .from("section_courses")
    .select(`
      id,
      sections ( name, terms ( name, is_active ) ),
      courses ( code, name, enable_cp, enable_assignments, enable_quizzes )
    `);
  const sectionCourses = data || [];

  // Fetch all assessments
  const { data: assessmentsData } = await supabase
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
        sections ( name, terms ( name, is_active ) ),
        courses ( code, name, enable_cp, enable_assignments, enable_quizzes )
      )
    `)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Assessments</h1>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 md:items-stretch">
        {/* ── Create Assessment ──────────────────────────────── */}
        <Card data-edge id="create-assessment-card">
          <CardHeader>
            <CardTitle>Create Assessment</CardTitle>
            <CardDescription>
              Add a new graded assessment (quiz, assignment, cp, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAssessmentForm sectionCourses={sectionCourses} />
          </CardContent>
        </Card>

        {/* ── Existing Assessments ──────────────────────────── */}
        <AssessmentsList
          assessments={assessmentsData || []}
          sectionCourses={sectionCourses}
        />
      </div>
    </div>
  );
}
