"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";

export type AtRiskClass = {
  scId: string;
  label: string; // e.g. "3B · CS2001"
  students: { roll: string; name: string; email: string | null; overall: number; missing: number }[];
};

const LEVELS = [30, 40, 50, 60];
const STORAGE_KEY = "tams-at-risk-level";
const SHOW = 8;

// Overview card: students whose overall (out of everything marked so far,
// best-of applied, same as Analytics) is below a chosen level, per class
export function AtRiskCard({ classes }: { classes: AtRiskClass[] }) {
  const [level, setLevel] = useState(40);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (LEVELS.includes(saved)) setLevel(saved);
    } catch {
      // storage blocked: keep the default
    }
  }, []);

  function choose(n: number) {
    setLevel(n);
    try {
      localStorage.setItem(STORAGE_KEY, String(n));
    } catch {
      // ignore
    }
  }

  const groups = classes
    .map((c) => ({
      ...c,
      below: c.students.filter((s) => s.overall < level).sort((a, b) => a.overall - b.overall),
    }))
    .filter((c) => c.students.length > 0);
  const total = groups.reduce((n, g) => n + g.below.length, 0);

  return (
    <div className="tams-card" data-edge>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="tams-card__title flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Students at risk
          </h2>
          <p className="tams-card__hint">
            Overall below {level}% of everything marked so far (missing marks count as 0, best-of applied)
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1" role="group" aria-label="At-risk level">
          {LEVELS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => choose(n)}
              aria-pressed={level === n}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                level === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              &lt;{n}%
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No marks in the active term yet.</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">No students are below {level}%. Nice.</p>
      ) : (
        <div className="space-y-4">
          {groups
            .filter((g) => g.below.length > 0)
            .map((g) => {
              const emails = g.below.map((s) => s.email).filter((e): e is string => !!e);
              const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(
                `${g.label}: your progress`
              )}`;
              return (
                <div key={g.scId} className="tams-inset p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {g.label}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {g.below.length} of {g.students.length} students
                      </span>
                    </p>
                    <div className="flex gap-2">
                      {emails.length > 0 && (
                        <a
                          href={mailto}
                          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-tip="Opens your email app with these students in BCC"
                        >
                          <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email them
                        </a>
                      )}
                      <Link
                        href={`/ta/analytics?sc=${encodeURIComponent(g.scId)}`}
                        className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Open Analytics
                      </Link>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {g.below.slice(0, SHOW).map((s) => (
                      <li key={s.roll}>
                        <Link
                          href={`/ta/analytics/student?sc=${encodeURIComponent(g.scId)}&roll=${encodeURIComponent(s.roll)}`}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-tip={s.missing > 0 ? `${s.missing} marked assessment${s.missing === 1 ? "" : "s"} without a mark` : "View full report"}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground">{s.roll}</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">{s.overall.toFixed(1)}%</span>
                        </Link>
                      </li>
                    ))}
                    {g.below.length > SHOW && (
                      <li>
                        <Link
                          href={`/ta/analytics?sc=${encodeURIComponent(g.scId)}`}
                          className="inline-flex rounded-full px-3 py-1 text-xs text-muted-foreground hover:underline"
                        >
                          +{g.below.length - SHOW} more
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
