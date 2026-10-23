"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export type MarkEntry = {
  roll_number: string;
  assessment_id: string;
  score: number | null;
};

export function PerformanceTable({
  students,
  sortedAssessments,
  marks,
}: {
  students: StudentPerformance[];
  sortedAssessments: AssessmentPerformance[];
  marks: MarkEntry[];
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleRow = (roll_number: string) => {
    setExpandedRow((prev) => (prev === roll_number ? null : roll_number));
  };

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
        <div className="relative max-w-sm mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or roll number"
            className="pl-9"
          />
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
                  <th>Roll Number</th>
                  <th>Student</th>
                  <th className="tams-numeral">Graded</th>
                  <th className="tams-numeral">Weight Obtained</th>
                  <th className="tams-numeral">Total Weight</th>
                  <th className="tams-numeral">Percentage</th>
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
                      <td>{p.roll_number}</td>
                      <td>{p.full_name}</td>
                      <td className="tams-numeral">
                        {p.graded === 0 ? "—" : p.graded}
                      </td>
                      <td className="tams-numeral">
                        {p.graded === 0 ? "—" : p.obtained}
                      </td>
                      <td className="tams-numeral">
                        {p.graded === 0 ? "—" : p.total_weight}
                      </td>
                      <td className="tams-numeral">
                        {p.percentage === null ? "—" : `${p.percentage.toFixed(1)}%`}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="p-0 border-b">
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
                                  let scoreStr = "—";

                                  if (mark && mark.score !== null && mark.score !== undefined) {
                                    const weighted =
                                      (mark.score / a.total_marks) * a.weight;
                                    totalCalculatedWeight += weighted;
                                    weightedStr = weighted.toFixed(2);
                                    scoreStr = `${mark.score} / ${a.total_marks}`;
                                  }

                                  return (
                                    <tr key={a.id}>
                                      <td>{a.title}</td>
                                      <td className="capitalize">{a.type}</td>
                                      <td className="tams-numeral">{scoreStr}</td>
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
