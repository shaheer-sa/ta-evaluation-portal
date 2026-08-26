import { createClient } from "@/lib/supabase/server";
import { createAssessment, deleteAssessment } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteAssessmentButton } from "@/components/delete-assessment-button";
import { EditAssessmentDialog } from "@/components/edit-assessment-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const assessments = assessmentsData || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
        <p className="text-muted-foreground">
          Define assessments for each of your classes.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* ── Create Assessment ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Create Assessment</CardTitle>
            <CardDescription>
              Add a new graded item (quiz, assignment, exam, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAssessmentForm sectionCourses={sectionCourses} />
          </CardContent>
        </Card>

        {/* ── Existing Assessments ──────────────────────────── */}
        <Card>
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
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {termName} — Sec {sectionName} ({courseCode}) · {a.type} · {a.max_marks} marks · {a.weight}%
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <EditAssessmentDialog assessment={a} />
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
