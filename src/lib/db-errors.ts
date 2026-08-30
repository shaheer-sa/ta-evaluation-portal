export function friendlyDbError(e: { code?: string; message: string }): string {
  if (e.code === "23505") return "An assessment with that name already exists in this class.";
  if (e.code === "23503") return "That item is still linked to something else.";
  if (e.code === "23502") return "A required field was left blank.";
  if (e.code === "23514") return "That value isn't allowed.";
  return "Couldn't save. Please try again.";
}
