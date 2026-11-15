"use client";

import { useState, Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
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

export function PerformanceTable({
  students,
  sortedAssessments,
  marks,
  possible,
  marked,
}: {
  students: RankedPerformance[];
  sortedAssessments: AssessmentPerformance[];
  marks: MarkEntry[];
  possible: number;
  marked: number;
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleRow = (roll_number: string) => {
    setExpandedRow((prev) => (prev === roll_number ? null : roll_number));
  };

  // rank stays the same while searching
  const rankOf = new Map(students.map((s, i) => [s.roll_number, s.overall === null ? null : i + 1]));

  const query = searchQuery.trim().toLowerCase();
  const filteredStudents = students.filter((s) => {
    if (!query) return true;
    return (
      s.roll_number.toLowerCase().includes(query) ||
      s.full_name.toLowerCase().includes(query)
    );
  });

  return (
    <Card data-edge>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or roll number"
              className="pl-9"
            />
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            Ranked by weight obtained out of {formatWeight(possible)} ({marked}{" "}
            {marked === 1 ? "assessment" : "assessments"} marked so far). A missing mark
            counts as 0 here, so students can&apos;t rank high on just a few marks.
          </p>
        </div>

        {filteredStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {`No students match "${searchQuery}".`}
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
                      className="transition-colors hover:bg-muted/50 cursor-pointer"
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
                        <td colSpan={8} className="p-0 border-b">
                          <div className="p-4 pl-12">
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
