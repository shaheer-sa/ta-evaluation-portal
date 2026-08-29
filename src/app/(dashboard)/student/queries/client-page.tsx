"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, MessageSquare } from "lucide-react";
import { QueryThread } from "@/components/query-thread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  in_review: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-600 border-green-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
};

export type QueryItem = Pick<Database["public"]["Tables"]["queries"]["Row"], "id" | "title" | "description" | "priority" | "status" | "created_at"> & {
  assessments: Pick<Database["public"]["Tables"]["assessments"]["Row"], "title"> | null;
};

export type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id" | "section_id" | "course_id"> & {
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
  sections: Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> | null;
};

export type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "type">;

interface ClientProps {
  initialQueries: QueryItem[];
  enrollments: EnrollmentRow[];
  assessments: AssessmentRow[];
  selectedEnrollment: string;
}

export default function StudentQueriesClient({
  initialQueries,
  enrollments,
  assessments,
  selectedEnrollment,
}: ClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Note: Since `initialQueries` updates via `router.refresh()`, we can just
  // map over it directly instead of maintaining a local `queries` state.
  
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [selectedAssessment, setSelectedAssessment] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: selectedEnrollment,
          assessmentId: selectedAssessment || null,
          title: formTitle,
          description: formDescription,
          priority: formPriority,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Query submitted!");
      setShowForm(false);
      setFormTitle("");
      setFormDescription("");
      setFormPriority("medium");
      
      // Update the URL to clear the selected enrollment, closing out the form data state.
      router.push("/student/queries");
      router.refresh();
    } catch {
      toast.error("Failed to submit query");
    } finally {
      setIsSubmitting(false);
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
          <p className="tams-pagehead__eyebrow">STUDENT</p>
          <h1 className="tams-pagehead__title">My Queries</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          New Query
        </Button>
      </div>

      {showForm && (
        <Card data-edge>
          <CardHeader>
            <CardTitle>Submit a Query</CardTitle>
            <CardDescription>
              Select the course and assessment, then describe your concern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Course</Label>
                    {isPending && <span className="tams-select__pending">Loading…</span>}
                  </div>
                  <select
                    value={selectedEnrollment}
                    disabled={isPending}
                    onChange={(e) => {
                      const val = e.target.value;
                      startTransition(() => {
                        if (val) {
                          router.push(`?enrollment=${val}`);
                        } else {
                          router.push(`/student/queries`);
                        }
                      });
                    }}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">Select...</option>
                    {enrollments.map((en) => (
                      <option key={en.id} value={en.id}>
                        {en.courses?.code} — {en.courses?.name} (Sec {en.sections?.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Assessment (optional)</Label>
                  <select
                    value={selectedAssessment}
                    onChange={(e) => setSelectedAssessment(e.target.value)}
                    disabled={!selectedEnrollment}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">General / None</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  placeholder="e.g. Quiz 2 re-evaluation request"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Explain your concern in detail..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Query
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {initialQueries.length === 0 ? (
        <Card data-edge>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              You haven&apos;t submitted any queries yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {initialQueries.map((q) => (
            <Card data-edge key={q.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{q.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {q.assessments?.title || "General query"} · {q.priority} priority
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
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                  {q.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(q.created_at)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  >
                    <MessageSquare className="mr-1 h-3.5 w-3.5" />
                    Thread
                  </Button>
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
