"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteAssessmentButton } from "@/components/delete-assessment-button";
import { EditAssessmentDialog } from "@/components/edit-assessment-dialog";
import { deleteAssessment, updateBestOf } from "./actions";
import { groupAssessments, sectionCourseLabel } from "./group-assessments";
import type { AssessmentItem, SectionCourseInfo } from "./group-assessments";

interface AssessmentsListProps {
  assessments: AssessmentItem[];
  sectionCourses: SectionCourseInfo[];
}

function BestOfSectionForm({
  sectionCourseId,
  bestOfQuizzes,
  bestOfAssignments,
  quizCount,
  assignmentCount,
}: {
  sectionCourseId: string;
  bestOfQuizzes?: number | null;
  bestOfAssignments?: number | null;
  quizCount: number;
  assignmentCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  if (quizCount === 0 && assignmentCount === 0) return null;

  return (
    <form
      key={`${bestOfQuizzes ?? ""}-${bestOfAssignments ?? ""}`}
      action={(formData) => {
        startTransition(async () => {
          try {
            const res = await updateBestOf(formData);
            if (!res.ok) {
              toast.error(res.message);
              return;
            }
            toast.success("Saved.");
          } catch {
            toast.error("Failed to save");
          }
        });
      }}
      className="space-y-1.5 pt-1 pb-1"
    >
      <input type="hidden" name="sectionCourseId" value={sectionCourseId} />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {quizCount > 0 && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <span>Count best</span>
            <input
              type="number"
              name="bestOfQuizzes"
              min="1"
              step="1"
              defaultValue={bestOfQuizzes ?? ""}
              className="h-7 w-14 rounded-md border border-input bg-background px-2 text-center text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <span>
              of {quizCount} {quizCount === 1 ? "quiz" : "quizzes"}
            </span>
          </label>
        )}

        {assignmentCount > 0 && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <span>Count best</span>
            <input
              type="number"
              name="bestOfAssignments"
              min="1"
              step="1"
              defaultValue={bestOfAssignments ?? ""}
              className="h-7 w-14 rounded-md border border-input bg-background px-2 text-center text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <span>
              of {assignmentCount}{" "}
              {assignmentCount === 1 ? "assignment" : "assignments"}
            </span>
          </label>
        )}

        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={isPending}
          className="h-7 px-3 text-xs"
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Only each student&apos;s best marks of that type count. Give each quiz the
        weight it&apos;s worth when counted (e.g. best 5 of 8 for 10% → weight 2
        each). Leave empty to count all.
      </p>
    </form>
  );
}

export function AssessmentsList({ assessments, sectionCourses }: AssessmentsListProps) {
  const groups = groupAssessments(assessments, sectionCourses);

  if (!groups.length) {
    return (
      <Card data-edge>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No assessments created yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const { sectionName, courseCode } = sectionCourseLabel(group.sectionCourse);
        const bestOfQuizzes = group.sectionCourse?.best_of_quizzes;
        const bestOfAssignments = group.sectionCourse?.best_of_assignments;

        return (
          <Card
            data-edge
            key={group.sectionCourseId}
            id={`sc-${group.sectionCourseId}`}
            style={{ scrollMarginTop: "5rem" }}
          >
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{group.label}</CardTitle>
                {bestOfQuizzes && (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
                    Best {bestOfQuizzes} of {group.quizCount}{" "}
                    {group.quizCount === 1 ? "quiz" : "quizzes"}
                  </span>
                )}
                {bestOfAssignments && (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
                    Best {bestOfAssignments} of {group.assignmentCount}{" "}
                    {group.assignmentCount === 1 ? "assignment" : "assignments"}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {group.assessments.length}{" "}
                  {group.assessments.length === 1 ? "assessment" : "assessments"}
                </span>
              </div>
              <BestOfSectionForm
                sectionCourseId={group.sectionCourseId}
                bestOfQuizzes={bestOfQuizzes}
                bestOfAssignments={bestOfAssignments}
                quizCount={group.quizCount}
                assignmentCount={group.assignmentCount}
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {group.assessments.map((a) => {
                const courseFlags = sectionCourses.find(
                  (sc) => sc.id === a.section_course_id
                )?.courses;
                return (
                  <div
                    key={a.id}
                    className="tams-inset flex items-center justify-between p-3"
                  >
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.type} · {a.max_marks} marks · weight {a.weight}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <EditAssessmentDialog
                        assessment={a}
                        courseFlags={
                          courseFlags
                            ? {
                                enable_cp: courseFlags.enable_cp ?? undefined,
                                enable_assignments: courseFlags.enable_assignments ?? undefined,
                                enable_quizzes: courseFlags.enable_quizzes ?? undefined,
                              }
                            : undefined
                        }
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
