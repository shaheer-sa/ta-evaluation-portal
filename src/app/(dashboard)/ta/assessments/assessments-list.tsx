"use client";

import { useState, useRef, useEffect, useTransition } from "react";
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
import { sortAssessments } from "@/lib/assessment-order";
import { cn } from "@/lib/utils";

type SectionCourseInfo = {
  id: string;
  best_of_quizzes?: number | null;
  best_of_assignments?: number | null;
  sections?: {
    name?: string | null;
    terms?: {
      name?: string | null;
      is_active?: boolean | null;
    } | null;
  } | null;
  courses?: {
    code?: string | null;
    name?: string | null;
    enable_cp?: boolean | null;
    enable_assignments?: boolean | null;
    enable_quizzes?: boolean | null;
  } | null;
};

type AssessmentItem = {
  id: string;
  section_course_id: string;
  type: "assignment" | "quiz" | "mid" | "final" | "project" | "cp";
  title: string;
  max_marks: number;
  weight: number;
  created_at?: string | null;
  section_courses?: SectionCourseInfo | null;
};

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
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [desktopHeight, setDesktopHeight] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Group assessments by section_course_id
  const groupsMap = new Map<
    string,
    {
      sectionCourseId: string;
      sectionCourse: SectionCourseInfo | null;
      assessments: AssessmentItem[];
    }
  >();

  for (const a of assessments) {
    let group = groupsMap.get(a.section_course_id);
    if (!group) {
      const sc =
        a.section_courses ||
        sectionCourses.find((s) => s.id === a.section_course_id) ||
        null;
      group = {
        sectionCourseId: a.section_course_id,
        sectionCourse: sc,
        assessments: [],
      };
      groupsMap.set(a.section_course_id, group);
    }
    group.assessments.push(a);
  }

  const groups = Array.from(groupsMap.values());

  // Group order: active term first, then by section name (natural order, "3B" before "3C"), then course code.
  groups.sort((a, b) => {
    const termA = a.sectionCourse?.sections?.terms;
    const termB = b.sectionCourse?.sections?.terms;
    const activeA = termA?.is_active ? 1 : 0;
    const activeB = termB?.is_active ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;

    const secA = a.sectionCourse?.sections?.name || "";
    const secB = b.sectionCourse?.sections?.name || "";
    const secCompare = secA.localeCompare(secB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (secCompare !== 0) return secCompare;

    const codeA = a.sectionCourse?.courses?.code || "";
    const codeB = b.sectionCourse?.courses?.code || "";
    return codeA.localeCompare(codeB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  // Inside each group use sortAssessments
  for (const group of groups) {
    group.assessments = sortAssessments(group.assessments);
  }

  const totalCount = assessments.length;

  useEffect(() => {
    const updateHeight = () => {
      if (window.innerWidth >= 768) {
        const createCard = document.getElementById("create-assessment-card");
        if (createCard) {
          setDesktopHeight(createCard.offsetHeight);
        }
      } else {
        setDesktopHeight(null);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    const createCard = document.getElementById("create-assessment-card");
    let observer: ResizeObserver | null = null;
    if (createCard && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => updateHeight());
      observer.observe(createCard);
    }

    return () => {
      window.removeEventListener("resize", updateHeight);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (expanded) return;
    const checkOverflow = () => {
      const el = listRef.current;
      if (!el) return;
      setHasOverflow(el.scrollHeight > el.clientHeight + 4);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [desktopHeight, expanded, groups.length]);

  return (
    <Card
      data-edge
      className={cn(
        "flex flex-col relative",
        !expanded && "max-h-[28rem] md:max-h-none"
      )}
      style={
        !expanded && desktopHeight ? { maxHeight: `${desktopHeight}px` } : undefined
      }
    >
      <CardHeader>
        <CardTitle>Existing Assessments</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col min-h-0 relative">
        {!groups.length ? (
          <p className="text-sm text-muted-foreground">
            No assessments created yet.
          </p>
        ) : (
          <>
            <div
              ref={listRef}
              className={cn(
                "space-y-6",
                !expanded ? "flex-1 min-h-0 overflow-hidden" : ""
              )}
            >
              {groups.map((group) => {
                const termName =
                  group.sectionCourse?.sections?.terms?.name || "Term";
                const sectionName =
                  group.sectionCourse?.sections?.name || "Sec";
                const courseCode =
                  group.sectionCourse?.courses?.code || "Course";
                const count = group.assessments.length;

                const quizCount = group.assessments.filter(
                  (a) => a.type === "quiz"
                ).length;
                const assignmentCount = group.assessments.filter(
                  (a) => a.type === "assignment"
                ).length;
                const bestOfQuizzes = group.sectionCourse?.best_of_quizzes;
                const bestOfAssignments =
                  group.sectionCourse?.best_of_assignments;

                return (
                  <div key={group.sectionCourseId} className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 border-b pb-1.5">
                      <h3 className="font-semibold text-sm">
                        {termName} — Section {sectionName} · {courseCode}
                      </h3>
                      {bestOfQuizzes && (
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
                          Best {bestOfQuizzes} of {quizCount}{" "}
                          {quizCount === 1 ? "quiz" : "quizzes"}
                        </span>
                      )}
                      {bestOfAssignments && (
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground">
                          Best {bestOfAssignments} of {assignmentCount}{" "}
                          {assignmentCount === 1 ? "assignment" : "assignments"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {count} {count === 1 ? "assessment" : "assessments"}
                      </span>
                    </div>

                    <BestOfSectionForm
                      sectionCourseId={group.sectionCourseId}
                      bestOfQuizzes={bestOfQuizzes}
                      bestOfAssignments={bestOfAssignments}
                      quizCount={quizCount}
                      assignmentCount={assignmentCount}
                    />

                    <div className="space-y-2">
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
                                {a.type} · {a.max_marks} marks · {a.weight}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <EditAssessmentDialog
                                assessment={a}
                                courseFlags={
                                  courseFlags
                                    ? {
                                        enable_cp:
                                          courseFlags.enable_cp ?? undefined,
                                        enable_assignments:
                                          courseFlags.enable_assignments ??
                                          undefined,
                                        enable_quizzes:
                                          courseFlags.enable_quizzes ??
                                          undefined,
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
                    </div>
                  </div>
                );
              })}
            </div>

            {!expanded && hasOverflow && (
              <div className="pointer-events-none absolute inset-x-6 bottom-14 h-16 bg-gradient-to-t from-card to-transparent" />
            )}

            {hasOverflow && (
              <div className="pt-3 mt-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "Show less" : `Show all (${totalCount})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
