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
