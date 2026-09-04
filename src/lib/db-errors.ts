export function friendlyDbError(
  e: { code?: string; message: string },
  entity = "item"
): string {
  if (e.code === "23505") return `That ${entity} already exists — try a different name or code.`;
  if (e.code === "23503") return `That ${entity} is still linked to something else.`;
  if (e.code === "23502") return "A required field was left blank.";
  if (e.code === "23514") return "That value isn't allowed.";
  if (e.code === "22P02") return "Something in that form was in the wrong format.";
  return "Couldn't save. Please try again.";
}
