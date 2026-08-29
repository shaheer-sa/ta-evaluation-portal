export const TYPE_ORDER: Record<string, number> = { assignment: 0, quiz: 1, cp: 2 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sortAssessments<T extends Record<string, any>>(assessments: T[]): T[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return [...assessments].sort((a: any, b: any) => {
    const ta = TYPE_ORDER[a.type] ?? 99;
    const tb = TYPE_ORDER[b.type] ?? 99;
    if (ta !== tb) return ta - tb;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}
