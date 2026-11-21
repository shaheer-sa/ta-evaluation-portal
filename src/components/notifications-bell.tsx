"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Bell, Megaphone } from "lucide-react";
import { useUpdates } from "@/components/updates/updates-provider";
import { MarksEmailToggle } from "@/components/updates/marks-email-toggle";
import { PushToggle } from "@/components/push-toggle";
import { InstallButton } from "@/components/install-button";
import { formatReleaseDate } from "@/lib/updates";
import { fetchJson } from "@/lib/fetch-json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

// the bell groups notifications into these sections (empty ones are hidden)
const SECTIONS: { key: string; label: string; types: string[] | null }[] = [
  { key: "marks", label: "Marks", types: ["marks_updated"] },
  { key: "queries", label: "Queries", types: ["new_query", "query_reply", "query_update"] },
  { key: "issues", label: "Issue reports", types: ["issue_report", "issue_resolved"] },
  { key: "resets", label: "Password resets", types: ["password_reset_request"] },
  { key: "other", label: "Other", types: null },
];

function sectionOf(type: string): string {
  return SECTIONS.find((s) => s.types?.includes(type))?.key || "other";
}

function getNotificationTargetUrl(n: Notification, pathname: string): string | null {
  const isTA = pathname.startsWith("/ta");

  if (n.type === "password_reset_request") {
    if (n.related_id) {
      return `/ta/roster?student=${n.related_id}`;
    }
    return null;
  }

  if (n.type === "issue_report") {
    return n.related_id ? `/ta/reports?open=${n.related_id}` : "/ta/reports";
  }

  // new marks: open that course's marks (related_id is the enrollment)
  if (n.type === "marks_updated") {
    return n.related_id ? `/student/course/${n.related_id}` : "/student";
  }

  if (n.type === "new_query" || n.type === "query_reply" || n.type === "query_update") {
    if (n.related_id) {
      return isTA ? `/ta/queries?open=${n.related_id}` : `/student/queries?open=${n.related_id}`;
    }
    return isTA ? "/ta/queries" : "/student/queries";
  }

  return null;
}

export function NotificationsBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // release notes the user hasn't seen yet (from the updates provider)
  const updates = useUpdates();
  const unseenReleases = updates?.unseenReleases ?? [];
  const totalUnread = unreadCount + unseenReleases.length;
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await fetchJson("/api/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail — notifications are not critical
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds, but only while the tab is open in front.
    // background tabs don't need it, and it saves data on phones
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchNotifications();
    }, 30000);
    // coming back to the tab: check right away instead of waiting
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchNotifications]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function clearAll() {
    const previousNotifications = notifications;
    const previousUnread = unreadCount;
    setNotifications([]);
    setUnreadCount(0);

    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error();
      }
    } catch {
      toast.error("Couldn't clear notifications. Please try again.");
      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
    }
  }

  async function clearSection(sectionKey: string) {
    const items = notifications.filter((n) => sectionOf(n.type) === sectionKey);
    if (items.length === 0) return;
    const previousNotifications = notifications;
    const previousUnread = unreadCount;
    const ids = new Set(items.map((n) => n.id));
    setNotifications((prev) => prev.filter((n) => !ids.has(n.id)));
    setUnreadCount((prev) => Math.max(0, prev - items.filter((n) => !n.is_read).length));

    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...ids] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Couldn't clear notifications. Please try again.");
      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
    }
  }

  async function dismissNotification(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    const previousNotifications = notifications;
    const previousUnread = unreadCount;
    setNotifications((prev) => prev.filter((item) => item.id !== n.id));
    if (!n.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      if (!res.ok) {
        throw new Error();
      }
    } catch {
      toast.error("Couldn't clear notifications. Please try again.");
      setNotifications(previousNotifications);
      setUnreadCount(previousUnread);
    }
  }

  async function handleNotificationClick(n: Notification) {
    const targetUrl = getNotificationTargetUrl(n, pathname);
    if (!targetUrl) return;

    if (!n.is_read) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [n.id] }),
      }).catch((err) => console.error("Failed to mark notification read:", err));

      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    setIsOpen(false);
    router.push(targetUrl);
  }

  function formatTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        data-tip="Notifications"
        data-tip-pos="bottom-end"
        aria-label={totalUnread > 0 ? `Notifications (${totalUnread} unread)` : "Notifications"}
        className="relative text-muted-foreground hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 overflow-hidden rounded-lg border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b p-3">
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex items-center gap-2">
                {totalUnread > 0 && (
                  <button
                    onClick={() => {
                      if (unreadCount > 0) markAllRead();
                      updates?.markSeen(unseenReleases.map((r) => `release:${r.id}`));
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {unseenReleases.length > 0 && (
                <section aria-label="Updates">
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-muted px-3 py-1.5">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Updates
                      <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-primary-foreground">
                        {unseenReleases.length} new
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => updates?.markSeen(unseenReleases.map((r) => `release:${r.id}`))}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  {unseenReleases.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-start justify-between border-b bg-primary/5 transition-colors hover:bg-muted/50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          updates?.markSeen([`release:${r.id}`]);
                          setIsOpen(false);
                          router.push(`/${updates?.role ?? "student"}/updates#release-${r.id}`);
                        }}
                        className="flex flex-1 items-start gap-2.5 p-3 text-left text-sm"
                      >
                        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>
                          <span className="block font-medium">TAMS {r.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {r.summary[updates?.role ?? "student"]}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {formatReleaseDate(r.date)} · {r.items.length} change{r.items.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updates?.markSeen([`release:${r.id}`])}
                        aria-label="Dismiss update"
                        data-tip="Dismiss"
                        data-tip-pos="left"
                        className="p-3 text-sm font-medium leading-none text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </section>
              )}
              {notifications.length === 0 ? (
                unseenReleases.length === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </p>
                )
              ) : (
                SECTIONS.map((section) => {
                  const items = notifications.filter((n) => sectionOf(n.type) === section.key);
                  if (items.length === 0) return null;
                  const unread = items.filter((n) => !n.is_read).length;
                  return (
                    <section key={section.key} aria-label={section.label}>
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-muted px-3 py-1.5">
                        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {section.label}
                          {unread > 0 && (
                            <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-primary-foreground">
                              {unread} new
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => clearSection(section.key)}
                          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                      {items.map((n) => {
                        const content = (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{n.title}</p>
                                {n.body && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {n.body}
                                  </p>
                                )}
                              </div>
                              {!n.is_read && (
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatTime(n.created_at)}
                            </p>
                          </>
                        );

                        const targetUrl = getNotificationTargetUrl(n, pathname);
                        return (
                          <div
                            key={n.id}
                            className={cn(
                              "flex items-start justify-between border-b last:border-0 hover:bg-muted/50 transition-colors",
                              !n.is_read && "bg-primary/5"
                            )}
                          >
                            {targetUrl ? (
                              <button
                                type="button"
                                onClick={() => handleNotificationClick(n)}
                                className="flex-1 text-left p-3 text-sm cursor-pointer"
                              >
                                {content}
                              </button>
                            ) : (
                              <div className="flex-1 p-3 text-sm">
                                {content}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => dismissNotification(e, n)}
                              aria-label="Dismiss notification"
                              data-tip="Dismiss"
                              data-tip-pos="left"
                              className="p-3 text-muted-foreground hover:text-foreground text-sm font-medium leading-none shrink-0"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </section>
                  );
                })
              )}
            </div>
            {updates?.role === "student" && <MarksEmailToggle />}
            <PushToggle />
            <InstallButton variant="panel" />
            <Link
              href={`/${updates?.role ?? "student"}/updates`}
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 border-t p-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
              What&apos;s new in TAMS
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
