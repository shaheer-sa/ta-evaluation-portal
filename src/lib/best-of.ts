// "best of n" for quizzes and assignments, set per class (section_courses).
// Only a student's n best marks of that type (by percentage) count toward
// their total. null means every graded mark counts.
// Must match the rule in the analytics_for_section_course database function.

export type BestOf = {
  quiz: number | null;
  assignment: number | null;
};

type AssessmentLike = {
  id: string;
  type: string;
  max_marks: number;
  created_at?: string | null;
};

export function bestOfFromSectionCourse(
  sc: { best_of_quizzes?: number | null; best_of_assignments?: number | null } | null | undefined
): BestOf {
  return {
    quiz: sc?.best_of_quizzes ?? null,
    assignment: sc?.best_of_assignments ?? null,
  };
}

/**
 * Returns the ids of the assessments whose marks count for one student.
 * `scores` maps assessment id -> score (only graded marks, no nulls).
 */
export function countedAssessmentIds(
  assessments: AssessmentLike[],
  scores: Map<string, number>,
  bestOf: BestOf
): Set<string> {
  const counted = new Set<string>();
  const byType = new Map<string, AssessmentLike[]>();

  for (const a of assessments) {
    if (!scores.has(a.id)) continue;
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type)!.push(a);
  }

  for (const [type, list] of byType) {
    const limit =
      type === "quiz" ? bestOf.quiz : type === "assignment" ? bestOf.assignment : null;

    if (!limit) {
      list.forEach((a) => counted.add(a.id));
      continue;
    }

    const pct = (a: AssessmentLike) =>
      a.max_marks > 0 ? (scores.get(a.id) ?? 0) / a.max_marks : 0;

    [...list]
      .sort((x, y) => {
        const diff = pct(y) - pct(x);
        if (diff !== 0) return diff;
        const dx = new Date(x.created_at || 0).getTime();
        const dy = new Date(y.created_at || 0).getTime();
        if (dx !== dy) return dx - dy;
        return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
      })
      .slice(0, limit)
      .forEach((a) => counted.add(a.id));
  }

  return counted;
}
