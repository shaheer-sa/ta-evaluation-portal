import { redirect } from "next/navigation";

// Root page — middleware handles the redirect based on auth state:
// - Logged out → /login
// - Logged in as TA → /ta
// - Logged in as student → /student
// This is just a fallback in case middleware doesn't catch it.
export default function Home() {
  redirect("/login");
}
