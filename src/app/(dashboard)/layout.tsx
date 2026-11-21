"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu, X, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReportIssueButton } from "@/components/report-issue";
import { UpdatesProvider } from "@/components/updates/updates-provider";
import { FeatureNote } from "@/components/updates/feature-note";
import { WhatsNewPopup } from "@/components/updates/whats-new-popup";
import { CURRENT_VERSION } from "@/lib/updates";
import LineSidebar from "@/components/react-bits/LineSidebar";
import ClickSpark from "@/components/react-bits/ClickSpark";
import RouteProgress from "@/components/shell/RouteProgress";

import { TA_NAV, STUDENT_NAV } from "@/components/shell/nav-config";
import { turnOffPush } from "@/lib/push-client";

// "Report an issue" for students is hidden unless NEXT_PUBLIC_ISSUE_REPORTS=on
// is set in Vercel (then redeploy). lets it be switched off without code changes.
const ISSUE_REPORTS_ON = process.env.NEXT_PUBLIC_ISSUE_REPORTS === "on";

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
    // an unsent issue report draft shouldn't stay for the next person on this browser
    try {
      localStorage.removeItem("tams-issue-draft");
    } catch {
      // ignore
    }
    // stop phone notifications on this device for the account that's leaving
    await Promise.race([turnOffPush().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
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
    <UpdatesProvider role={isStudent ? "student" : "ta"}>
    <ClickSpark>
      <div className="tams-body">
        <div className="tams-shell">
          <RouteProgress />
          
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
                  <GraduationCap size={20} color="var(--navy)" />
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
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="tams-rail__nav">
              <LineSidebar 
                items={navItems.map(n => n.label)}
                hrefs={navItems.map(n => n.href)}
                defaultActive={activeIndex >= 0 ? activeIndex : null}
                accentColor="var(--sand)"
                textColor="hsl(39 45% 88%)"
                markerColor="hsl(39 40% 90% / 0.4)"
                onItemClick={() => {
                   setMobileMenuOpen(false);
                }}
              />
            </div>

            <div className="tams-rail__footer">
              {isStudent && ISSUE_REPORTS_ON && <ReportIssueButton variant="rail" />}
              <button className="tams-iconbtn w-full" onClick={handleLogout} style={{ width: '100%', padding: '0 1rem', display: 'flex', gap: '0.5rem' }}>
                <LogOut size={16} /> Sign out
              </button>
              <Link
                href={isStudent ? "/student/updates" : "/ta/updates"}
                onClick={() => setMobileMenuOpen(false)}
                className="tams-rail__version"
                data-tip="See what's new in this version"
                data-tip-pos="top"
              >
                TAMS v{CURRENT_VERSION} · What&apos;s New
              </Link>
            </div>
          </aside>

          <div className="tams-content">
            <header className="tams-topbar border-b">
              <button 
                className="tams-iconbtn tams-mobile-only"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <div className="tams-topbar__title">
                {navItems[activeIndex]?.label || "Dashboard"}
              </div>
              <div className="tams-topbar__spacer" />
              <div className="flex items-center gap-2">
                {isStudent && ISSUE_REPORTS_ON && <ReportIssueButton variant="topbar" />}
                <ThemeToggle />
                <NotificationsBell />
              </div>
            </header>
            
            <main className="tams-main">
              {isStudent && <FeatureNote id="bell-push" className="mb-6" />}
              {isStudent && <FeatureNote id="bell-updates" className="mb-6" />}
              {children}
            </main>
            <WhatsNewPopup />
          </div>
        </div>
      </div>
    </ClickSpark>
    </UpdatesProvider>
  );
}
