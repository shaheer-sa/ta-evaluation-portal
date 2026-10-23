import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentsList } from "../assessments-list";
import { loadAssessmentsData } from "../load-assessments";

// full list of assessments per class (not in the sidebar, opened from Assessments)
export default async function AllAssessmentsPage() {
  const { sectionCourses, assessments } = await loadAssessmentsData();

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/ta/assessments">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Assessments
        </Link>
      </Button>

      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">All Assessments</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block max-w-[280px]">
          Edit, delete and set best-of counting for each class.
        </p>
      </div>

      <AssessmentsList assessments={assessments} sectionCourses={sectionCourses} />
    </div>
  );
}
