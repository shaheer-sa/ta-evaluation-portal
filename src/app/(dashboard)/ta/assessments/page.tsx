import { createClient } from "@/lib/supabase/server";
import { createAssessment, deleteAssessment } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteAssessmentButton } from "@/components/delete-assessment-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ASSESSMENT_TYPES = [
  { value: "assignment", label: "Assignment" },
  { value: "quiz", label: "Quiz" },
  { value: "mid", label: "Midterm" },
  { value: "final", label: "Final" },
  { value: "project", label: "Project" },
  { value: "cp", label: "Class Participation" },
];

export default async function AssessmentsPage() {
  const supabase = await createClient();

  // Fetch section-courses for dropdown
  const { data: sectionCourses } = await supabase
    .from("section_courses")
    .select(`
      id,
      sections ( name, terms ( name ) ),
      courses ( code, name )
    `);

  // Fetch all assessments grouped by section_course
  const { data: assessments } = await supabase
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
            <form action={createAssessment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sectionCourseId">Class</Label>
                <select
                  id="sectionCourseId"
                  name="sectionCourseId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a class...</option>
                  {sectionCourses?.map((sc) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const termName = (sc.sections as any)?.terms?.name;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const sectionName = (sc.sections as any)?.name;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const courseCode = (sc.courses as any)?.code;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const courseName = (sc.courses as any)?.name;
                    return (
                      <option key={sc.id} value={sc.id}>
                        {termName} — Section {sectionName} ({courseCode} {courseName})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {ASSESSMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  placeholder="e.g. Quiz 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxMarks">Max Marks</Label>
                  <Input
                    id="maxMarks"
                    name="maxMarks"
                    type="number"
                    required
                    step="0.5"
                    min="0"
                    placeholder="e.g. 20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (%)</Label>
                  <Input
                    id="weight"
                    name="weight"
                    type="number"
                    required
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="e.g. 10"
                  />
                </div>
              </div>

              <Button type="submit">Create Assessment</Button>
            </form>
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const termName = (a.section_courses as any)?.sections?.terms?.name;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const sectionName = (a.section_courses as any)?.sections?.name;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const courseCode = (a.section_courses as any)?.courses?.code;
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
                      <DeleteAssessmentButton
                        assessmentId={a.id}
                        assessmentLabel={`${a.title} — Sec ${sectionName} (${courseCode})`}
                        deleteAction={deleteAssessment}
                      />
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
