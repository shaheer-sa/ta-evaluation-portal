"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
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

function getNotificationTargetUrl(n: Notification, pathname: string): string | null {
  const isTA = pathname.startsWith("/ta");

  if (n.type === "password_reset_request") {
    if (n.related_id) {
      return `/ta/roster?student=${n.related_id}`;
    }
    return null;
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
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
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
        className="relative text-muted-foreground hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
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
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b p-3">
              <span className="text-sm font-semibold">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
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
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              ) : (
                notifications.map((n) => {
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
                        title="Dismiss"
                        className="p-3 text-muted-foreground hover:text-foreground text-sm font-medium leading-none shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
