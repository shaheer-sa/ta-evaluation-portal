"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";

const TA_NAV = [
  { href: "/ta", label: "Overview", exact: true },
  { href: "/ta/courses", label: "Courses & Terms", exact: true },
  { href: "/ta/sections", label: "Sections", exact: true },
  { href: "/ta/roster", label: "Roster & Sync", exact: false },
  { href: "/ta/assessments", label: "Assessments", exact: true },
  { href: "/ta/grading", label: "Grading", exact: true },
  { href: "/ta/queries", label: "Queries", exact: true },
  { href: "/ta/analytics", label: "Analytics", exact: true },
];

const STUDENT_NAV = [
  { href: "/student", label: "My Grades", exact: true },
  { href: "/student/queries", label: "Queries", exact: false },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isTA = pathname.startsWith("/ta");
  const isStudent = pathname.startsWith("/student");
  const navItems = isTA ? TA_NAV : isStudent ? STUDENT_NAV : [];

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        toast.success("Logged out successfully");
        router.push("/login");
        router.refresh();
      } else {
        toast.error("Failed to log out");
      }
    } catch {
      toast.error("An error occurred during logout");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-primary">TAMS</span>
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-2 rounded-md transition-colors hover:text-foreground",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <NotificationsBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="container mx-auto max-w-5xl py-8">{children}</main>
    </div>
  );
}

