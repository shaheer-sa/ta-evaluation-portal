import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { groupAssessments } from "./group-assessments";
import type { AssessmentItem, SectionCourseInfo } from "./group-assessments";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// short per-section overview; the full list lives on /ta/assessments/all
export function AssessmentsSummary({
  assessments,
  sectionCourses,
}: {
  assessments: AssessmentItem[];
  sectionCourses: SectionCourseInfo[];
}) {
  const groups = groupAssessments(assessments, sectionCourses);

  return (
    <Card data-edge>
      <CardHeader>
        <CardTitle>Existing Assessments</CardTitle>
        <CardDescription>
          {assessments.length > 0
            ? `${plural(assessments.length, "assessment", "assessments")} in ${plural(groups.length, "class", "classes")}. Open a class to edit or delete.`
            : "Nothing created yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((g) => {
          const parts = [
            g.assignmentCount && plural(g.assignmentCount, "assignment", "assignments"),
            g.quizCount && plural(g.quizCount, "quiz", "quizzes"),
            g.cpCount && plural(g.cpCount, "CP", "CP"),
          ].filter(Boolean);
          const bestOf = [
            g.sectionCourse?.best_of_quizzes && `best ${g.sectionCourse.best_of_quizzes} quizzes`,
            g.sectionCourse?.best_of_assignments && `best ${g.sectionCourse.best_of_assignments} assignments`,
          ].filter(Boolean);
          return (
            <Link
              key={g.sectionCourseId}
              href={`/ta/assessments/all#sc-${g.sectionCourseId}`}
              className="tams-inset flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{g.label}</div>
                <div className="text-xs text-muted-foreground">
                  {parts.join(" · ")}
                  {bestOf.length > 0 && ` · counting ${bestOf.join(", ")}`}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}

        {assessments.length > 0 && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/ta/assessments/all">View all &amp; edit</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
