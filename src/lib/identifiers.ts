/** Escapes LIKE metacharacters so ilike behaves as case-insensitive equality. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
