// ranks students against the same total for everyone, so a student who only has
// 1 or 2 marks entered can't top the list just because those marks were good.
//
// possible = weight of every assessment that has been marked for at least one
// student in the class (best-of respected), i.e. what a student who did
// everything so far could have. overall = obtained / possible, so missing
// marks count as 0 here.

type Student = {
  roll_number: string;
  graded: number;
  obtained: number;
  total_weight: number;
  percentage: number | null;
};

type Assessment = {
  type: string;
  weight: number;
  graded: number;
};

export type BestOfSettings = {
  quiz?: number | null;
  assignment?: number | null;
};

export type RankedStudent<S> = S & {
  overall: number | null;
  missing: number;
};

export function possibleWeight(assessments: Assessment[], bestOf: BestOfSettings): number {
  const done = assessments.filter((a) => a.graded > 0);
  let total = 0;
  for (const type of new Set(done.map((a) => a.type))) {
    const weights = done
      .filter((a) => a.type === type)
      .map((a) => Number(a.weight) || 0)
      .sort((x, y) => y - x);
    const limit = type === "quiz" ? bestOf.quiz : type === "assignment" ? bestOf.assignment : null;
    const counted = limit && limit < weights.length ? weights.slice(0, limit) : weights;
    total += counted.reduce((sum, w) => sum + w, 0);
  }
  return total;
}

export function rankStudents<S extends Student>(
  students: S[],
  assessments: Assessment[],
  bestOf: BestOfSettings
): { ranked: RankedStudent<S>[]; possible: number; marked: number } {
  // a full-marks student's own total can't be above the real total, use whichever is bigger
  const fromAssessments = possibleWeight(assessments, bestOf);
  const fromStudents = Math.max(0, ...students.map((s) => Number(s.total_weight) || 0));
  const possible = Math.max(fromAssessments, fromStudents);
  const marked = assessments.filter((a) => a.graded > 0).length;

  const ranked = students.map((s) => ({
    ...s,
    overall:
      possible > 0 && s.graded > 0
        ? Math.round(((Number(s.obtained) || 0) / possible) * 1000) / 10
        : null,
    missing: Math.max(0, marked - s.graded),
  }));

  ranked.sort((a, b) => {
    // students with nothing marked go to the bottom
    if (a.overall === null && b.overall !== null) return 1;
    if (b.overall === null && a.overall !== null) return -1;
    const diff = (Number(b.obtained) || 0) - (Number(a.obtained) || 0);
    if (Math.abs(diff) > 1e-9) return diff;
    // same total: fewer missing marks first, then roll number
    if (a.missing !== b.missing) return a.missing - b.missing;
    return a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true });
  });

  return { ranked, possible, marked };
}
