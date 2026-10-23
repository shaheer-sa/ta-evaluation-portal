export const TYPE_ORDER: Record<string, number> = { assignment: 0, quiz: 1, cp: 2 };

// assignments first, then quizzes, then cp. inside a type, by the number in
// the title (Quiz 2 before Quiz 10), then by creation date
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sortAssessments<T extends Record<string, any>>(assessments: T[]): T[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...assessments].sort((a: any, b: any) => {
    const ta = TYPE_ORDER[a.type] ?? 99;
    const tb = TYPE_ORDER[b.type] ?? 99;
    if (ta !== tb) return ta - tb;
    const byTitle = String(a.title ?? "").localeCompare(String(b.title ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (byTitle !== 0) return byTitle;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}
