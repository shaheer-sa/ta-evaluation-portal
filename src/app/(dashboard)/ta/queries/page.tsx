"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { QueryThread } from "@/components/query-thread";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatStatus } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  in_review: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-600 border-green-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-yellow-600",
  high: "text-red-600 font-semibold",
};

import type { Database } from "@/types/database";

type QueryItem = Pick<Database["public"]["Tables"]["queries"]["Row"], "id" | "title" | "description" | "priority" | "status" | "created_at"> & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name" | "roll_number"> | null;
  assessments: Pick<Database["public"]["Tables"]["assessments"]["Row"], "title"> | null;
  enrollments?: { sections: { name: string } | null } | null;
};

function TAQueriesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openId = searchParams.get("open");
  const handledOpenRef = useRef<string | null>(null);

  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [deleteQueryId, setDeleteQueryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchQueries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchJson(`/api/queries?status=${statusFilter}`);
      setQueries(data.queries);
    } catch {
      toast.error("Failed to load queries");
    }
    setIsLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  useEffect(() => {
    if (!openId || isLoading) return;
    if (handledOpenRef.current === openId) return;

    const found = queries.some((q) => q.id === openId);
    if (found) {
      handledOpenRef.current = openId;
      setExpandedId(openId);
      setHighlightId(openId);
      router.replace(pathname, { scroll: false });
    } else if (statusFilter !== "all") {
      setStatusFilter("all");
    } else {
      handledOpenRef.current = openId;
      toast.info("That query isn't in the current list. It may belong to an old term or was deleted.");
      router.replace(pathname, { scroll: false });
    }
  }, [openId, queries, isLoading, statusFilter, router, pathname]);

  useEffect(() => {
    if (!highlightId) return;

    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`query-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);

    const clearTimer = setTimeout(() => {
      setHighlightId(null);
    }, 3000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightId]);

  async function updateStatus(queryId: string, newStatus: string) {
    setUpdatingId(queryId);
    try {
      await fetchJson("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", queryId, newStatus }),
      });
      toast.success(`Query marked as ${formatStatus(newStatus)}`);
      fetchQueries();
    } catch {
      toast.error("Failed to update query");
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Student Queries</h1>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s.value}
            variant={statusFilter === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : queries.length === 0 ? (
        <Card data-edge>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No queries found for this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queries.map((q) => (
            <Card
              data-edge
              key={q.id}
              id={`query-${q.id}`}
              className={cn(
                highlightId === q.id && "ring-2 ring-primary ring-offset-2 motion-safe:animate-pulse"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{q.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {q.profiles?.roll_number} · {q.profiles?.full_name} · {q.enrollments?.sections?.name || "—"}
                      {q.assessments?.title && ` · ${q.assessments.title}`}
                      {" · "}
                      <span className={PRIORITY_COLORS[q.priority]}>
                        {q.priority} priority
                      </span>
                    </CardDescription>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      STATUS_COLORS[q.status] || ""
                    )}
                  >
                    {formatStatus(q.status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4">
                  {q.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(q.created_at)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                    >
                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                      Thread
                    </Button>
                    {q.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === q.id}
                          onClick={() => updateStatus(q.id, "in_review")}
                        >
                          Start Review
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={updatingId === q.id}
                          onClick={() => updateStatus(q.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {q.status === "in_review" && (
                      <>
                        <Button
                          size="sm"
                          disabled={updatingId === q.id}
                          onClick={() => updateStatus(q.id, "resolved")}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={updatingId === q.id}
                          onClick={() => updateStatus(q.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {(q.status === "resolved" || q.status === "rejected") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === q.id}
                        onClick={() => updateStatus(q.id, "in_review")}
                      >
                        Reopen
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteQueryId(q.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <QueryThread queryId={q.id} isOpen={expandedId === q.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteQueryId}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteQueryId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this query?</AlertDialogTitle>
            <AlertDialogDescription>
              The query and its whole reply thread will be removed for you and the student. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!deleteQueryId) return;
                setIsDeleting(true);
                try {
                  const res = await fetch(`/api/queries?id=${deleteQueryId}`, {
                    method: "DELETE",
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    throw new Error(data.error || "Couldn't delete the query. Please try again.");
                  }
                  toast.success("Query deleted.");
                  setDeleteQueryId(null);
                  fetchQueries();
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : "Couldn't delete the query. Please try again.");
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "Deleting…" : "Delete query"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function TAQueriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TAQueriesContent />
    </Suspense>
  );
}
