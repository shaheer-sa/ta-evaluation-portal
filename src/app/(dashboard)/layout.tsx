"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu, X, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NotificationsBell } from "@/components/notifications-bell";
import LineSidebar from "@/components/react-bits/LineSidebar";
import ClickSpark from "@/components/react-bits/ClickSpark";
import AmbientField from "@/components/shell/AmbientField";
import CardEdgeTracker from "@/components/shell/CardEdgeTracker";
import RouteProgress from "@/components/shell/RouteProgress";

const TA_NAV = [
  { href: "/ta", label: "Overview", exact: true },
  { href: "/ta/courses", label: "Courses & Terms", exact: true },
  { href: "/ta/sections", label: "Sections", exact: true },
  { href: "/ta/roster", label: "Students", exact: false },
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
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeIndex = navItems.findIndex(item => 
    item.exact ? pathname === item.href : pathname.startsWith(item.href)
  );

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
    <ClickSpark>
      <div className="tams-body">
        <div className="tams-shell">
          <AmbientField />
          <RouteProgress />
          <CardEdgeTracker />
          
          {mobileMenuOpen && (
            <div 
              className="tams-scrim tams-mobile-only" 
              onClick={() => setMobileMenuOpen(false)}
            />
          )}

          <aside 
            className="tams-rail" 
            data-open={mobileMenuOpen}
          >
            <div className="tams-rail__brand">
              <Link href={isTA ? "/ta" : "/student"} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
                <div className="tams-rail__mark">
                  <GraduationCap size={20} color="var(--primary-fg)" />
                </div>
                <div>
                  <div className="tams-rail__name">TAMS</div>
                  <span className="tams-rail__role">
                    {isTA ? 'Teaching Assistant' : 'Student'}
                  </span>
                </div>
              </Link>
              <button 
                className="tams-iconbtn tams-mobile-only ml-auto"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="tams-rail__nav">
              <LineSidebar 
                items={navItems.map(n => n.label)}
                defaultActive={activeIndex >= 0 ? activeIndex : null}
                accentColor="var(--navy)"
                textColor="var(--navy)"
                onItemClick={(idx) => {
                   router.push(navItems[idx].href);
                   setMobileMenuOpen(false);
                }}
              />
            </div>

            <div className="tams-rail__footer">
              <button className="tams-iconbtn w-full" onClick={handleLogout} style={{ width: '100%', padding: '0 1rem', display: 'flex', gap: '0.5rem' }}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </aside>

          <div className="tams-content">
            <header className="tams-topbar border-b">
              <button 
                className="tams-iconbtn tams-mobile-only"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu size={18} />
              </button>
              <div className="tams-topbar__title">
                {navItems[activeIndex]?.label || "Dashboard"}
              </div>
              <div className="tams-topbar__spacer" />
              <NotificationsBell />
            </header>
            
            <main className="tams-main">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ClickSpark>
  );
}
