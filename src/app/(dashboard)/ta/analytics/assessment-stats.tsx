"use client";

import { Fragment, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { AssessmentPerformance, MarkEntry } from "./performance-table";
import { focusStudent } from "./focus-student";

type Pick = { id: string; kind: "max" | "min" } | null;

export function AssessmentStats({
  assessments,
  marks,
  names,
}: {
  assessments: AssessmentPerformance[];
  marks: MarkEntry[];
  // roll number -> student name
  names: Record<string, string>;
}) {
  const [open, setOpen] = useState<Pick>(null);

  const toggle = (id: string, kind: "max" | "min") =>
    setOpen((prev) => (prev && prev.id === id && prev.kind === kind ? null : { id, kind }));

  // everyone who got exactly this score on this assessment (ties included)
  const scoredBy = (assessmentId: string, score: number) =>
    marks
      .filter(
        (m) =>
          m.assessment_id === assessmentId &&
          m.score !== null &&
          Math.abs(Number(m.score) - Number(score)) < 1e-9 &&
          names[m.roll_number] !== undefined
      )
      .map((m) => ({ roll: m.roll_number, name: names[m.roll_number] }))
      .sort((x, y) => x.roll.localeCompare(y.roll, undefined, { numeric: true }));

  const ScoreButton = ({ a, kind }: { a: AssessmentPerformance; kind: "max" | "min" }) => {
    const value = kind === "max" ? a.high : a.low;
    if (value === null) return <>—</>;
    const isOpen = open?.id === a.id && open.kind === kind;
    // hover shows who scored it (first 3, then "+N more")
    const who = scoredBy(a.id, value);
    const shown = who.slice(0, 3).map((w) => `${w.name} (${w.roll})`).join(", ");
    const tip = who.length === 0 ? "No active student" : who.length > 3 ? `${shown} +${who.length - 3} more` : shown;
    return (
      <button
        type="button"
        onClick={() => toggle(a.id, kind)}
        aria-expanded={isOpen}
        aria-label={`${kind === "max" ? "Max" : "Min"} ${value}: ${tip}`}
        data-tip={tip}
        data-tip-pos="left"
        data-tip-fast=""
        className={`rounded px-1.5 py-0.5 underline decoration-dotted underline-offset-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isOpen ? "bg-muted font-semibold" : ""
        }`}
      >
        {value}
      </button>
    );
  };

  return (
    <Card data-edge className="mb-8">
      <CardContent>
        <div className="tams-table-wrap">
          <table className="tams-table">
            <thead>
              <tr>
                <th>Assessment</th>
                <th className="tams-numeral">Total Marks</th>
                <th className="tams-numeral">Graded</th>
                <th className="tams-numeral">Average</th>
                <th className="tams-numeral">Max</th>
                <th className="tams-numeral">Min</th>
              </tr>
            </thead>
            <tbody>
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-8">
                    No assessments found.
                  </td>
                </tr>
              ) : (
                assessments.map((a) => {
                  const isOpen = open?.id === a.id;
                  const value = isOpen ? (open.kind === "max" ? a.high : a.low) : null;
                  const who = isOpen && value !== null ? scoredBy(a.id, value) : [];
                  return (
                    <Fragment key={a.id}>
                      <tr className="transition-colors">
                        <td>{a.title}</td>
                        <td className="tams-numeral">{a.total_marks}</td>
                        <td className="tams-numeral">{a.graded}</td>
                        <td className="tams-numeral">{a.avg !== null ? a.avg : "—"}</td>
                        <td className="tams-numeral">
                          <ScoreButton a={a} kind="max" />
                        </td>
                        <td className="tams-numeral">
                          <ScoreButton a={a} kind="min" />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30">
                          <td colSpan={6} className="text-sm">
                            <span className="font-medium">
                              {open.kind === "max" ? "Max" : "Min"} {value} / {a.total_marks}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}· scored by {who.length === 0 ? "no active student" : who.length === 1 ? "" : `${who.length} students: `}
                            </span>
                            {who.map((w, i) => (
                              <span key={w.roll}>
                                {i > 0 && ", "}
                                <button
                                  type="button"
                                  onClick={() => focusStudent(w.roll)}
                                  className="rounded px-0.5 font-medium underline decoration-dotted underline-offset-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {w.name} <span className="font-normal text-muted-foreground">({w.roll})</span>
                                </button>
                              </span>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
