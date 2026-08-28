"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Plus, MessageSquare } from "lucide-react";
import { QueryThread } from "@/components/query-thread";
import { createClient } from "@/lib/supabase/client";
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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  in_review: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-600 border-green-500/30",
  rejected: "bg-red-500/10 text-red-600 border-red-500/30",
};

import type { Database } from "@/types/database";

type QueryItem = Pick<Database["public"]["Tables"]["queries"]["Row"], "id" | "title" | "description" | "priority" | "status" | "created_at"> & {
  assessments: Pick<Database["public"]["Tables"]["assessments"]["Row"], "title"> | null;
};

type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id" | "section_id" | "course_id"> & {
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
  sections: Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> | null;
};

type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "type">;

interface ClientProps {
  initialQueries: QueryItem[];
}

export default function StudentQueriesClient({ initialQueries }: ClientProps) {
  const supabase = createClient();
  const [queries, setQueries] = useState<QueryItem[]>(initialQueries);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // For the create form
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [selectedAssessment, setSelectedAssessment] = useState("");

  async function fetchQueries() {
    try {
      const res = await fetch("/api/queries?status=all");
      const data = await res.json();
      if (res.ok) setQueries(data.queries);
    } catch {
      toast.error("Failed to load queries");
    }
  }

  // Load enrollments for the form
  useEffect(() => {
    async function loadEnrollments() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rawEnrollments, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        section_id,
        course_id,
        courses ( code, name ),
        sections ( name )
      `)
      .eq("student_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setEnrollments(rawEnrollments || []);
    }
    loadEnrollments();
  }, [supabase]);

  // Load assessments when enrollment changes
  useEffect(() => {
    setSelectedAssessment("");
    if (!selectedEnrollment) {
      setAssessments([]);
      return;
    }

    const enrollment = enrollments.find((e) => e.id === selectedEnrollment);
    if (!enrollment) return;

    async function loadAssessments() {
      // Find section_course for this enrollment
      const { data: sc } = await supabase
        .from("section_courses")
        .select("id")
        .eq("section_id", enrollment?.section_id || "")
        .eq("course_id", enrollment?.course_id || "")
        .single();

      if (sc) {
        const { data } = await supabase
          .from("assessments")
          .select("id, title, type")
          .eq("section_course_id", sc.id)
          .order("created_at", { ascending: true });
        if (data) setAssessments(data);
      }
    }
    loadAssessments();
  }, [selectedEnrollment, enrollments, supabase]);

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
      setSelectedEnrollment("");
      fetchQueries();
    } catch {
      toast.error("Failed to submit query");
    }
    setIsSubmitting(false);
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

      {/* Create Form */}
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
                  <Label>Course</Label>
                  <select
                    value={selectedEnrollment}
                    onChange={(e) => setSelectedEnrollment(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {/* Query List */}
      {queries.length === 0 ? (
        <Card data-edge>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              You haven&apos;t submitted any queries yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queries.map((q) => (
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
