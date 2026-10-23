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
              Add a new graded assessment (quiz, assignment, cp, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAssessmentForm sectionCourses={sectionCourses} />
          </CardContent>
        </Card>

        <AssessmentsSummary assessments={assessments} sectionCourses={sectionCourses} />
      </div>
    </div>
  );
}
