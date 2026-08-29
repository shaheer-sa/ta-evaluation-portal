import { createClient } from "@/lib/supabase/server";
import { deleteAssessment } from "./actions";
import { DeleteAssessmentButton } from "@/components/delete-assessment-button";
import { EditAssessmentDialog } from "@/components/edit-assessment-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sortAssessments } from "@/lib/assessment-order";

import { CreateAssessmentForm } from "./create-assessment-form";

export default async function AssessmentsPage() {
  const supabase = await createClient();

  // Fetch section-courses for dropdown
  const { data } = await supabase
    .from("section_courses")
    .select(`
      id,
      sections ( name, terms ( name ) ),
      courses ( code, name, enable_cp, enable_assignments, enable_quizzes )
    `);
  const sectionCourses = data || [];

  // Fetch all assessments grouped by section_course
  const { data: assessmentsData } = await supabase
    .from("assessments")
    .select(`
      id,
      section_course_id,
      type,
      title,
      max_marks,
      weight,
      section_courses (
        sections ( name, terms ( name ) ),
        courses ( code )
      )
    `)
    .order("created_at", { ascending: true });
  const assessments = sortAssessments(assessmentsData || []);

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Assessments</h1>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Create Assessment ──────────────────────────────── */}
        <Card data-edge>
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
        <Card data-edge>
          <CardHeader>
            <CardTitle>Existing Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {!assessments?.length ? (
              <p className="text-sm text-muted-foreground">
                No assessments created yet.
              </p>
            ) : (
              <div className="space-y-4">
                {assessments.map((a) => {
                  const termName = a.section_courses?.sections?.terms?.name;
                  const sectionName = a.section_courses?.sections?.name;
                  const courseCode = a.section_courses?.courses?.code;
                  return (
                    <div
                      key={a.id}
                      className="tams-inset flex items-center justify-between p-3"
                    >
                      <div>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {termName} — Sec {sectionName} ({courseCode}) · {a.type} · {a.max_marks} marks · {a.weight}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <EditAssessmentDialog
                          assessment={a}
                          courseFlags={sectionCourses.find((sc: { id: string }) => sc.id === a.section_course_id)?.courses}
                        />
                        <DeleteAssessmentButton
                          assessmentId={a.id}
                          assessmentLabel={`${a.title} — Sec ${sectionName} (${courseCode})`}
                          deleteAction={deleteAssessment}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
