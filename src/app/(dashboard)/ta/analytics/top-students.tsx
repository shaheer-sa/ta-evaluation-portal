"use client";

import { focusStudent } from "./focus-student";

const RANKS = ["1ST", "2ND", "3RD"];

export function TopStudents({
  students,
}: {
  students: { roll_number: string; full_name: string; overall: number | null; missing: number }[];
}) {
  if (students.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {students.map((p, i) => (
        <button
          key={p.roll_number}
          type="button"
          onClick={() => focusStudent(p.roll_number)}
          className="tams-stat text-left"
          data-cat="count"
          aria-label={`${RANKS[i]}: ${p.full_name}, ${p.overall?.toFixed(1)}%. Show their marks`}
        >
          <div className="tams-stat__header">
            <span className="tams-stat__label">{RANKS[i]}</span>
          </div>
          <div className="tams-stat__value">{p.overall?.toFixed(1)}%</div>
          <div className="tams-stat__meta">
            {p.full_name} <span className="opacity-70">({p.roll_number})</span>
            {p.missing > 0 && ` · ${p.missing} not marked`}
          </div>
        </button>
      ))}
    </div>
  );
}
