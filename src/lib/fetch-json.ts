export async function fetchJson(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  const type = res.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    throw new Error(
      res.status === 504 || res.status === 408
        ? "The server took too long. Try a smaller batch."
        : `Server error (${res.status}). Please try again.`
    );
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
