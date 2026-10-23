import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateAssessmentForm } from "./create-assessment-form";
import { AssessmentsSummary } from "./assessments-summary";
import { loadAssessmentsData } from "./load-assessments";

export default async function AssessmentsPage() {
  const { sectionCourses, assessments } = await loadAssessmentsData();

  const typeCounts: Record<string, number> = {};
  for (const a of assessments) {
    const key = `${a.section_course_id}:${a.type}`;
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  }

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Assessments</h1>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <Card data-edge>
          <CardHeader>
            <CardTitle>Create Assessment</CardTitle>
            <CardDescription>
              Add a new graded assessment (quiz, assignment, cp, etc.). Set total weights per class on the full list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAssessmentForm sectionCourses={sectionCourses} typeCounts={typeCounts} />
          </CardContent>
        </Card>

        <AssessmentsSummary assessments={assessments} sectionCourses={sectionCourses} />
      </div>
    </div>
  );
}
