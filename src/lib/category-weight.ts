// when a class has a total weight for quizzes or assignments, every one of that
// type gets total / (best-of if set and smaller than the count, else the count).
// the database does the real update (trigger), this is just for showing it in the ui.

export type CategoryType = "quiz" | "assignment";

type CategorySettings = {
  quiz_total_weight?: number | null;
  assignment_total_weight?: number | null;
  best_of_quizzes?: number | null;
  best_of_assignments?: number | null;
};

export function categoryTotal(sc: CategorySettings | null | undefined, type: string): number | null {
  if (!sc) return null;
  const v = type === "quiz" ? sc.quiz_total_weight : type === "assignment" ? sc.assignment_total_weight : null;
  return v === null || v === undefined ? null : Number(v);
}

export function categoryBestOf(sc: CategorySettings | null | undefined, type: string): number | null {
  if (!sc) return null;
  const v = type === "quiz" ? sc.best_of_quizzes : type === "assignment" ? sc.best_of_assignments : null;
  return v ?? null;
}

export function autoWeight(total: number, bestOf: number | null, count: number): number {
  if (count <= 0) return total;
  const counted = bestOf && bestOf < count ? bestOf : count;
  return total / counted;
}
