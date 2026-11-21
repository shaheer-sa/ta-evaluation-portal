"use client";

import { useState, useEffect, useRef, Fragment, type ReactNode } from "react";
import { FOCUS_STUDENT_EVENT } from "./focus-student";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileText, Filter, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatWeight } from "@/lib/format";

export type StudentPerformance = {
  full_name: string;
  roll_number: string;
  graded: number;
  obtained: number;
  total_weight: number;
  percentage: number | null;
};

export type AssessmentPerformance = {
  id: string;
  title: string;
  type: "assignment" | "quiz" | "mid" | "final" | "project" | "cp";
  created_at: string;
  total_marks: number;
  weight: number;
  avg: number | null;
  high: number | null;
  low: number | null;
  graded: number;
};

export type RankedPerformance = StudentPerformance & {
  // weight obtained out of everything marked so far for the class (missing = 0)
  overall: number | null;
  // assessments marked for the class that this student has no mark for
  missing: number;
};

export type MarkEntry = {
  roll_number: string;
  assessment_id: string;
  score: number | null;
  counted: boolean;
};

type FilterOp = "lt" | "lte" | "eq" | "gte" | "gt";

const FILTER_OPS: Record<FilterOp, { label: string; symbol: string }> = {
  lt: { label: "less than", symbol: "<" },
  lte: { label: "less than or equal to", symbol: "≤" },
  eq: { label: "equal to", symbol: "=" },
  gte: { label: "greater than or equal to", symbol: "≥" },
  gt: { label: "greater than", symbol: ">" },
};

// compared at 2 decimals, the same precision the table shows, so "equal to 4.5"
// matches a student shown as 4.5 even if the exact value is 4.4999
function matchesFilter(value: number, op: FilterOp, limit: number) {
  const v = Math.round(value * 100);
  const l = Math.round(limit * 100);
  switch (op) {
    case "lt":
      return v < l;
    case "lte":
      return v <= l;
    case "eq":
      return v === l;
    case "gte":
      return v >= l;
    case "gt":
      return v > l;
  }
}

export function PerformanceTable({
  students,
  sortedAssessments,
  marks,
  possible,
  marked,
  possibleTypes,
  scId,
  filterNote,
}: {
  students: RankedPerformance[];
  sortedAssessments: AssessmentPerformance[];
  marks: MarkEntry[];
  possible: number;
  marked: number;
  // what assignments / quizzes are worth so far, best-of applied
  possibleTypes: Record<string, number>;
  scId: string;
  // optional "new feature" note shown above the filters
  filterNote?: ReactNode;
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // another part of the page asked to show a student: search their roll
  // number, open their row and scroll down to it
  useEffect(() => {
    const onFocus = (e: Event) => {
      const roll = (e as CustomEvent<string>).detail;
      if (!roll) return;
      setSearchQuery(roll);
      setExpandedRow(roll);
      setHighlight(roll);
      // wait for the filtered table to render before scrolling
      requestAnimationFrame(() => {
        const row = document.getElementById(`student-row-${roll}`);
        (row || cardRef.current)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
    window.addEventListener(FOCUS_STUDENT_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_STUDENT_EVENT, onFocus);
  }, []);

  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(t);
  }, [highlight]);

  // absolutes per type for each student, from counted marks only (best-of applied)
  const assessmentById = new Map(sortedAssessments.map((a) => [a.id, a]));
  const typeAbs = new Map<string, { assignment: number; quiz: number }>();
  for (const m of marks) {
    if (m.score === null || !m.counted) continue;
    const a = assessmentById.get(m.assessment_id);
    if (!a || !a.total_marks || (a.type !== "assignment" && a.type !== "quiz")) continue;
    const cur = typeAbs.get(m.roll_number) || { assignment: 0, quiz: 0 };
    cur[a.type] += (Number(m.score) / a.total_marks) * (Number(a.weight) || 0);
    typeAbs.set(m.roll_number, cur);
  }
  const hasAssignments = (possibleTypes.assignment || 0) > 0;
  const hasQuizzes = (possibleTypes.quiz || 0) > 0;

  // filter: only students below a number of absolutes
  const [filterBy, setFilterBy] = useState<"overall" | "assignment" | "quiz">("overall");
  const [filterBelow, setFilterBelow] = useState("");
  const [filterOp, setFilterOp] = useState<FilterOp>("lte");
  const threshold = filterBelow.trim() === "" ? null : Number(filterBelow);
  const filterActive = threshold !== null && Number.isFinite(threshold);
  const valueFor = (s: RankedPerformance) =>
    filterBy === "overall" ? Number(s.obtained) || 0 : typeAbs.get(s.roll_number)?.[filterBy] ?? 0;
  const filterLabel = { overall: "overall", assignment: "assignments", quiz: "quizzes" }[filterBy];
  const filterOutOf = filterBy === "overall" ? possible : possibleTypes[filterBy] || 0;

  const toggleRow = (roll_number: string) => {
    setExpandedRow((prev) => (prev === roll_number ? null : roll_number));
  };

  // rank stays the same while searching
  const rankOf = new Map(students.map((s, i) => [s.roll_number, s.overall === null ? null : i + 1]));

  const query = searchQuery.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    if (filterActive && !matchesFilter(valueFor(s), filterOp, threshold as number)) return false;
    if (!query) return true;
    return (
      s.roll_number.toLowerCase().includes(query) ||
      s.full_name.toLowerCase().includes(query)
    );
  });

  return (
    <Card data-edge ref={cardRef} className="scroll-mt-20">
      <CardContent>
        <div className="mb-4 space-y-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or roll number"
              className="pl-9"
            />
          </div>

          {filterNote}

          <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filter students">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Show students with</span>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as typeof filterBy)}
              aria-label="Filter by"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="overall">Overall</option>
              {hasAssignments && <option value="assignment">Assignments</option>}
              {hasQuizzes && <option value="quiz">Quizzes</option>}
            </select>
            <span className="text-muted-foreground">absolutes</span>
            <select
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value as FilterOp)}
              aria-label="Condition"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {(Object.keys(FILTER_OPS) as FilterOp[]).map((op) => (
                <option key={op} value={op}>
                  {FILTER_OPS[op].label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={filterBelow}
              onChange={(e) => setFilterBelow(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="e.g. 5"
              aria-label="Absolutes limit"
              className="h-9 w-24"
            />
            {filterActive && (
              <>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium">
                  {filteredStudents.length} of {students.length} students · {filterLabel} {FILTER_OPS[filterOp].symbol}{" "}
                  {formatWeight(threshold)} / {formatWeight(filterOutOf)}
                </span>
                <button
                  type="button"
                  onClick={() => setFilterBelow("")}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" aria-hidden="true" /> Clear filter
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Best-of settings are applied to every total.</p>
        </div>

        {filteredStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {filterActive
              ? `No students have ${FILTER_OPS[filterOp].label} ${formatWeight(threshold)} absolutes in ${filterLabel}${query ? ` matching "${searchQuery}"` : ""}.`
              : `No students match "${searchQuery}".`}
          </p>
        ) : (
          <div className="tams-table-wrap">
            <table className="tams-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th className="tams-numeral w-10">#</th>
                  <th>Roll Number</th>
                  <th>Student</th>
                  <th className="tams-numeral">Marked</th>
                  {hasAssignments && (
                    <th className="tams-numeral" data-tip="Absolutes from assignments, best-of applied">
                      Assignments
                    </th>
                  )}
                  {hasQuizzes && (
                    <th className="tams-numeral" data-tip="Absolutes from quizzes, best-of applied">
                      Quizzes
                    </th>
                  )}
                  <th className="tams-numeral">Weight Obtained</th>
                  <th className="tams-numeral" data-tip="Out of everything marked so far. This is what the ranking uses.">
                    Overall
                  </th>
                  <th className="tams-numeral" data-tip="Average on only the assessments this student has marks for.">
                    On marked only
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((p) => {
                const isExpanded = expandedRow === p.roll_number;

                // Pre-calculate assessment marks for the expanded view
                let totalCalculatedWeight = 0;

                return (
                  <Fragment key={p.roll_number}>
                    <tr
                      id={`student-row-${p.roll_number}`}
                      className={`transition-colors hover:bg-muted/50 cursor-pointer ${
                        highlight === p.roll_number ? "bg-primary/10 motion-safe:animate-pulse" : ""
                      }`}
                      onClick={() => toggleRow(p.roll_number)}
                    >
                      <td className="w-8 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="tams-numeral text-muted-foreground">
                        {rankOf.get(p.roll_number) ?? "—"}
                      </td>
                      <td className="whitespace-nowrap">{p.roll_number}</td>
                      <td>{p.full_name}</td>
                      <td className="tams-numeral">
                        <span
                          className={p.missing > 0 ? "font-medium text-amber-600 dark:text-amber-400" : undefined}
                          data-tip={p.missing > 0 ? `${p.missing} marked ${p.missing === 1 ? "assessment has" : "assessments have"} no mark for this student` : undefined}
                        >
                          {p.graded} / {marked}
                        </span>
                      </td>
                      {hasAssignments && (
                        <td className="tams-numeral">
                          {p.graded === 0
                            ? "—"
                            : `${formatWeight(typeAbs.get(p.roll_number)?.assignment ?? 0)} / ${formatWeight(possibleTypes.assignment)}`}
                        </td>
                      )}
                      {hasQuizzes && (
                        <td className="tams-numeral">
                          {p.graded === 0
                            ? "—"
                            : `${formatWeight(typeAbs.get(p.roll_number)?.quiz ?? 0)} / ${formatWeight(possibleTypes.quiz)}`}
                        </td>
                      )}
                      <td className="tams-numeral">
                        {p.graded === 0 ? "—" : `${formatWeight(p.obtained)} / ${formatWeight(possible)}`}
                      </td>
                      <td className="tams-numeral font-semibold">
                        {p.overall === null ? "—" : `${p.overall.toFixed(1)}%`}
                      </td>
                      <td className="tams-numeral text-muted-foreground">
                        {p.percentage === null ? "—" : `${p.percentage.toFixed(1)}%`}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={8 + (hasAssignments ? 1 : 0) + (hasQuizzes ? 1 : 0)} className="p-0 border-b">
                          <div className="p-4 pl-12">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-medium">{p.full_name}&apos;s marks</span>
                              <Link
                                href={`/ta/analytics/student?sc=${encodeURIComponent(scId)}&roll=${encodeURIComponent(p.roll_number)}`}
                                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <FileText className="h-4 w-4" aria-hidden="true" />
                                View full report
                              </Link>
                            </div>
                            <table className="tams-table w-full text-sm">
                              <thead>
                                <tr>
                                  <th>Assessment</th>
                                  <th>Type</th>
                                  <th className="tams-numeral">Score</th>
                                  <th className="tams-numeral">Weighted</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedAssessments.map((a) => {
                                  const mark = marks.find(
                                    (m) =>
                                      m.assessment_id === a.id &&
                                      m.roll_number === p.roll_number
                                  );

                                  let weightedStr = "—";
                                  let scoreNode: ReactNode = "—";

                                  if (mark && mark.score !== null && mark.score !== undefined) {
                                    if (mark.counted === false) {
                                      scoreNode = (
                                        <span>
                                          {mark.score} / {a.total_marks}{" "}
                                          <span className="text-muted-foreground font-normal">
                                            (not counted)
                                          </span>
                                        </span>
                                      );
                                      weightedStr = "—";
                                    } else {
                                      const weighted =
                                        (mark.score / a.total_marks) * a.weight;
                                      totalCalculatedWeight += weighted;
                                      weightedStr = weighted.toFixed(2);
                                      scoreNode = `${mark.score} / ${a.total_marks}`;
                                    }
                                  }

                                  return (
                                    <tr key={a.id}>
                                      <td>{a.title}</td>
                                      <td className="capitalize">{a.type}</td>
                                      <td className="tams-numeral">{scoreNode}</td>
                                      <td className="tams-numeral">{weightedStr}</td>
                                    </tr>
                                  );
                                })}
                                <tr className="font-semibold bg-muted/40">
                                  <td colSpan={3} className="text-right">
                                    Total
                                  </td>
                                  <td className="tams-numeral">
                                    {totalCalculatedWeight.toFixed(2)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
