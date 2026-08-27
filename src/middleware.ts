import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that unauthenticated users can access
const PUBLIC_ROUTES = ["/login", "/forgot-password"];

// Reset password is a special case — accessible regardless of auth
// status (user arrives via email link which exchanges a code).
const RESET_ROUTE = "/reset-password";

export async function middleware(request: NextRequest) {
  const { supabase, user, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // ── Pass-through routes ──────────────────────────────────────
  // API routes and the auth callback handle their own authentication.
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  // Reset password page — always accessible
  if (pathname === RESET_ROUTE) {
    return supabaseResponse;
  }

  // ── Not logged in ────────────────────────────────────────────
  if (!user) {
    if (PUBLIC_ROUTES.includes(pathname)) {
      return supabaseResponse;
    }
    // Redirect any protected route to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Logged in — resolve role ─────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const dashboardPath = role === "ta" ? "/ta" : "/student";

  const mustChange = profile?.must_change_password === true;

  if (mustChange && pathname !== "/first-login") {
    const url = request.nextUrl.clone();
    url.pathname = "/first-login";
    return NextResponse.redirect(url);
  }

  if (!mustChange && pathname === "/first-login") {
    const url = request.nextUrl.clone();
    url.pathname = dashboardPath;
    return NextResponse.redirect(url);
  }

  // Logged-in user hitting auth pages or root → send to their dashboard
  if (PUBLIC_ROUTES.includes(pathname) || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = dashboardPath;
    return NextResponse.redirect(url);
  }

  // ── Role-based route protection ──────────────────────────────
  if (pathname.startsWith("/ta") && role !== "ta") {
    const url = request.nextUrl.clone();
    url.pathname = "/student";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/student") && role !== "student") {
    const url = request.nextUrl.clone();
    url.pathname = "/ta";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - static assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
