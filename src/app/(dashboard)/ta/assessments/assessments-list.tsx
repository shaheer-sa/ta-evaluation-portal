"use client";

import { useState, useTransition } from "react";
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
import { deleteAssessment, updateCategorySettings } from "./actions";
import { formatWeight } from "@/lib/format";
import { autoWeight, categoryTotal } from "@/lib/category-weight";
import { groupAssessments, sectionCourseLabel } from "./group-assessments";
import type { AssessmentItem, SectionCourseInfo } from "./group-assessments";

interface AssessmentsListProps {
  assessments: AssessmentItem[];
  sectionCourses: SectionCourseInfo[];
}

const inputClass =
  "h-7 w-16 rounded-md border border-input bg-background px-2 text-center text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function CategoryRow({
  label,
  count,
  totalName,
  bestName,
  total,
  best,
  onTotal,
  onBest,
}: {
  label: string;
  count: number;
  totalName: string;
  bestName: string;
  total: string;
  best: string;
  onTotal: (v: string) => void;
  onBest: (v: string) => void;
}) {
  const totalNum = Number(total);
  const bestNum = Number(best);
  const hasTotal = total.trim() !== "" && Number.isFinite(totalNum) && totalNum > 0;
  const hasBest = best.trim() !== "" && Number.isInteger(bestNum) && bestNum > 0;
  const counted = hasBest && bestNum < count ? bestNum : count;

  let preview = "Weights are set by hand on each one.";
  if (hasTotal) {
    preview = `${formatWeight(totalNum)} ÷ ${counted} = ${formatWeight(autoWeight(totalNum, hasBest ? bestNum : null, count))} each`;
  }
  if (hasBest && bestNum < count) {
    preview += ` · best ${bestNum} of ${count} count`;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      <span className="w-24 font-medium text-foreground">
        {label} ({count})
      </span>
      <label className="flex items-center gap-1.5">
        <span>Total weight</span>
        <input
          type="number"
          name={totalName}
          min="0"
          max="100"
          step="any"
          placeholder="—"
          value={total}
          onChange={(e) => onTotal(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span>Count best</span>
        <input
          type="number"
          name={bestName}
          min="1"
          step="1"
          placeholder="all"
          value={best}
          onChange={(e) => onBest(e.target.value)}
          className={inputClass}
        />
      </label>
      <span className="text-[11px]">→ {preview}</span>
    </div>
  );
}

function ClassWeightSettings({
  sectionCourseId,
  sc,
  quizCount,
  assignmentCount,
}: {
  sectionCourseId: string;
  sc: SectionCourseInfo | null;
  quizCount: number;
  assignmentCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const [quizTotal, setQuizTotal] = useState(str(sc?.quiz_total_weight));
  const [quizBest, setQuizBest] = useState(str(sc?.best_of_quizzes));
  const [asgTotal, setAsgTotal] = useState(str(sc?.assignment_total_weight));
  const [asgBest, setAsgBest] = useState(str(sc?.best_of_assignments));

  if (quizCount === 0 && assignmentCount === 0) return null;

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          try {
            const res = await updateCategorySettings(formData);
            if (!res.ok) {
              toast.error(res.message);
              return;
            }
            toast.success("Saved. Weights updated.");
          } catch {
            toast.error("Failed to save");
          }
        });
      }}
      className="space-y-2 rounded-md border border-dashed p-3"
    >
      <input type="hidden" name="sectionCourseId" value={sectionCourseId} />
      {quizCount > 0 && (
        <CategoryRow
          label="Quizzes"
          count={quizCount}
          totalName="quizTotalWeight"
          bestName="bestOfQuizzes"
          total={quizTotal}
          best={quizBest}
          onTotal={setQuizTotal}
          onBest={setQuizBest}
        />
      )}
      {assignmentCount > 0 && (
        <CategoryRow
          label="Assignments"
          count={assignmentCount}
          totalName="assignmentTotalWeight"
          bestName="bestOfAssignments"
          total={asgTotal}
          best={asgBest}
          onTotal={setAsgTotal}
          onBest={setAsgBest}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          With a total weight, each one&apos;s weight is worked out for you and updates
          when you add or delete one. Leave total empty to set weights by hand, and
          best empty to count all.
        </p>
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
        const quizTotal = categoryTotal(group.sectionCourse, "quiz");
        const assignmentTotal = categoryTotal(group.sectionCourse, "assignment");

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
                {quizTotal !== null && (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
                    Quizzes worth {formatWeight(quizTotal)}
                  </span>
                )}
                {assignmentTotal !== null && (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
                    Assignments worth {formatWeight(assignmentTotal)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {group.assessments.length}{" "}
                  {group.assessments.length === 1 ? "assessment" : "assessments"}
                </span>
              </div>
              <ClassWeightSettings
                key={[
                  group.sectionCourse?.quiz_total_weight,
                  bestOfQuizzes,
                  group.sectionCourse?.assignment_total_weight,
                  bestOfAssignments,
                ].join("|")}
                sectionCourseId={group.sectionCourseId}
                sc={group.sectionCourse}
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
                        {a.type} · {a.max_marks} marks · weight {formatWeight(a.weight)}
                        {categoryTotal(group.sectionCourse, a.type) !== null && " (auto)"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <EditAssessmentDialog
                        assessment={a}
                        autoTotals={{
                          quiz: quizTotal,
                          assignment: assignmentTotal,
                        }}
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
