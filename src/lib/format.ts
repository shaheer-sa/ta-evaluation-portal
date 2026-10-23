export function formatStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_review":
      return "In review";
    case "resolved":
      return "Resolved";
    case "rejected":
      return "Rejected";
    default:
      // Fallback: capitalize first letter and replace underscores
      if (!status) return "";
      const readable = status.replace(/_/g, " ");
      return readable.charAt(0).toUpperCase() + readable.slice(1);
  }
}

// weights can be things like 1.6667 when worked out from a total, show at most 2 decimals
export function formatWeight(weight: number | string | null | undefined): string {
  const n = Number(weight);
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n * 100) / 100);
}
