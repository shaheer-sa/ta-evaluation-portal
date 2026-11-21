"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ImageViewer } from "@/components/image-viewer";

export type IssueReport = {
  id: string;
  category: string;
  message: string;
  page_url: string | null;
  user_agent: string | null;
  status: "open" | "fixed";
  created_at: string;
  resolved_at: string | null;
  // signed links to the screenshots (expire after an hour, refresh the page for new ones)
  screenshots: string[];
  profiles: { full_name: string | null; roll_number: string | null; email: string | null } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Something isn't working",
  display: "Something looks wrong",
  login: "Login or password",
  suggestion: "Suggestion",
  other: "Other",
};

// rough device name from the browser string, enough to know where to test
function deviceOf(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPhone|iPad/i.test(ua)) return "iPhone/iPad";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Linux/i.test(ua)) return "Linux";
  return null;
}

function formatDate(s: string) {
  return new Date(s).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Filter = "open" | "fixed" | "all";

export function ReportsList({ reports }: { reports: IssueReport[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");
  const handledRef = useRef<string | null>(null);

  const [filter, setFilter] = useState<Filter>("open");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // screenshot viewer: which report's images, and which one is showing
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);
  const [, startTransition] = useTransition();

  // coming from the bell or the email link: show that report
  useEffect(() => {
    if (!openId) {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === openId) return;
    handledRef.current = openId;
    const target = reports.find((r) => r.id === openId);
    if (target) {
      setFilter(target.status === "open" ? "open" : "all");
      setHighlightId(openId);
    } else {
      toast.info("That report wasn't found. It may have been removed.");
    }
    router.replace(pathname, { scroll: false });
  }, [openId, reports, router, pathname]);

  useEffect(() => {
    if (!highlightId) return;
    const scroll = setTimeout(() => {
      document.getElementById(`report-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    const clear = setTimeout(() => setHighlightId(null), 3000);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [highlightId]);

  async function setStatus(id: string, status: "open" | "fixed") {
    setBusyId(id);
    try {
      await fetchJson("/api/issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      toast.success(status === "fixed" ? "Marked as fixed" : "Reopened");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the report.");
    } finally {
      setBusyId(null);
    }
  }

  const openCount = reports.filter((r) => r.status === "open").length;
  const fixedCount = reports.length - openCount;
  const shown = reports.filter((r) => filter === "all" || r.status === filter);

  const tabs: { key: Filter; label: string }[] = [
    { key: "open", label: `Open (${openCount})` },
    { key: "fixed", label: `Fixed (${fixedCount})` },
    { key: "all", label: `All (${reports.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter reports">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={filter === t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card data-edge>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filter === "open" ? "No open reports. Nice." : "Nothing here yet."}
          </CardContent>
        </Card>
      ) : (
        shown.map((r) => {
          const device = deviceOf(r.user_agent);
          const isFixed = r.status === "fixed";
          return (
            <Card
              key={r.id}
              id={`report-${r.id}`}
              data-edge
              className={cn(
                "scroll-mt-24",
                highlightId === r.id && "ring-2 ring-primary ring-offset-2 motion-safe:animate-pulse"
              )}
            >
              <CardContent className="space-y-3 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {CATEGORY_LABELS[r.category] || "Other"}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          isFixed
                            ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {isFixed ? "Fixed" : "Open"}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        #{r.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm">
                      <span className="font-medium">{r.profiles?.full_name || "Student"}</span>{" "}
                      <span className="text-muted-foreground">({r.profiles?.roll_number || "—"})</span>
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>

                <p className="whitespace-pre-wrap text-sm">{r.message}</p>

                {r.screenshots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.screenshots.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setViewer({ images: r.screenshots, index: i })}
                        data-tip="View full size"
                        aria-label={`View screenshot ${i + 1} full size`}
                        className="block h-24 w-32 cursor-zoom-in overflow-hidden rounded-md border transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Screenshot ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    {r.page_url && (
                      <>
                        Page: <span className="font-mono">{r.page_url}</span>
                      </>
                    )}
                    {r.page_url && device && " · "}
                    {device && <span title={r.user_agent || undefined}>{device}</span>}
                    {isFixed && r.resolved_at && ` · fixed ${formatDate(r.resolved_at)}`}
                  </p>
                  <div className="flex gap-2">
                    {r.profiles?.email && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={`mailto:${r.profiles.email}?subject=${encodeURIComponent(`About your TAMS report #${r.id.slice(0, 8).toUpperCase()}`)}`}>
                          <Mail className="mr-1.5 h-3.5 w-3.5" />
                          Email student
                        </a>
                      </Button>
                    )}
                    {isFixed ? (
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setStatus(r.id, "open")}>
                        {busyId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                        Reopen
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busyId === r.id} onClick={() => setStatus(r.id, "fixed")}>
                        {busyId === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                        Mark fixed
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
      {viewer && (
        <ImageViewer
          images={viewer.images}
          index={viewer.index}
          onIndexChange={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
