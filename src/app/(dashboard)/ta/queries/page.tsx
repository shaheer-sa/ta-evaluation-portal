"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { QueryThread } from "@/components/query-thread";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
};

export default function TAQueriesPage() {
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchQueries = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/queries?status=${statusFilter}`);
      const data = await res.json();
      if (res.ok) setQueries(data.queries);
    } catch {
      toast.error("Failed to load queries");
    }
    setIsLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  async function updateStatus(queryId: string, newStatus: string) {
    setUpdatingId(queryId);
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateStatus", queryId, newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Query marked as ${newStatus}`);
      fetchQueries();
    } catch {
      toast.error("Failed to update query");
    }
    setUpdatingId(null);
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Queries</h1>
        <p className="text-muted-foreground">
          Review and resolve re-evaluation requests and student questions.
        </p>
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
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No queries found for this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queries.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{q.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {q.profiles?.full_name} ({q.profiles?.roll_number})
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
                    {q.status.replace("_", " ")}
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
                  </div>
                </div>
                <QueryThread queryId={q.id} isOpen={expandedId === q.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
