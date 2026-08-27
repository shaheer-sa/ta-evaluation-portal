"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Save, Search, AlertCircle } from "lucide-react";
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

interface StudentMark {
  enrollmentId: string;
  rollNumber: string;
  fullName: string;
  score: string;
}

import type { Database } from "@/types/database";

type SectionCourseRow = Pick<Database["public"]["Tables"]["section_courses"]["Row"], "id" | "section_id" | "course_id"> & {
  sections: (Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> & {
    terms: Pick<Database["public"]["Tables"]["terms"]["Row"], "name"> | null;
  }) | null;
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
};

type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "type" | "max_marks">;

type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id"> & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "roll_number" | "full_name"> | null;
  marks: Pick<Database["public"]["Tables"]["marks"]["Row"], "assessment_id" | "score">[];
};

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export default function GradingPage() {
  const supabase = createClient();
  const [sectionCourses, setSectionCourses] = useState<SectionCourseRow[]>([]);
  const [selectedSC, setSelectedSC] = useState("");
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [maxMarks, setMaxMarks] = useState(0);

  // Load section-courses
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("section_courses")
        .select(
          `id, section_id, course_id, sections ( name, terms ( name ) ), courses ( code, name )`
        );
      if (data) setSectionCourses(data);
    }
    load();
  }, [supabase]);

  // Load assessments when section-course changes
  useEffect(() => {
    setSelectedAssessment("");
    setStudentMarks([]);
    if (!selectedSC) {
      setAssessments([]);
      return;
    }
    async function loadAssessments() {
      const { data } = await supabase
        .from("assessments")
        .select("id, title, type, max_marks")
        .eq("section_course_id", selectedSC)
        .order("created_at", { ascending: true });
      if (data) setAssessments(data);
    }
    loadAssessments();
  }, [selectedSC, supabase]);

  // Load student marks when assessment changes
  const loadMarks = useCallback(async () => {
    if (!selectedAssessment || !selectedSC) return;
    setIsLoading(true);

    try {
      const assessment = assessments.find((a) => a.id === selectedAssessment);
      if (assessment) setMaxMarks(assessment.max_marks);

      const sc = sectionCourses.find((s) => s.id === selectedSC);
      // Previously an early `return` here left the spinner running forever.
      if (!sc) {
        setStudentMarks([]);
        return;
      }

      const { data: rawEnrollments, error } = await supabase
        .from("enrollments")
        .select(
          `
          id,
          profiles:student_id ( roll_number, full_name ),
          marks ( assessment_id, score )
        `
        )
        .eq("section_id", sc.section_id)
        .eq("course_id", sc.course_id);

      if (error) {
        toast.error("Couldn't load the roster for this class.");
        setStudentMarks([]);
        return;
      }

      const enrollments = (rawEnrollments as unknown as EnrollmentRow[]) || [];
      const mapped: StudentMark[] = enrollments.map((e) => {
        const scoreObj = e.marks.find(
          (m) => m.assessment_id === selectedAssessment
        );
        return {
          enrollmentId: e.id,
          rollNumber: e.profiles?.roll_number || "",
          fullName: e.profiles?.full_name || "",
          score:
            scoreObj && scoreObj.score !== null && scoreObj.score !== undefined
              ? String(scoreObj.score)
              : "",
        };
      });

      mapped.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      setStudentMarks(mapped);
    } finally {
      // Always clears, even on an early exit or a thrown error.
      setIsLoading(false);
    }
  }, [selectedAssessment, selectedSC, assessments, sectionCourses, supabase]);

  useEffect(() => {
    loadMarks();
  }, [loadMarks]);

  function handleScoreChange(enrollmentId: string, value: string) {
    setStudentMarks((prev) =>
      prev.map((s) => (s.enrollmentId === enrollmentId ? { ...s, score: value } : s))
    );
  }

  const filteredMarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return studentMarks;
    return studentMarks.filter(
      (s) =>
        s.rollNumber.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q)
    );
  }, [studentMarks, searchQuery]);

  // Client-side mirror of the server's validation, so a TA sees the problem
  // before they hit Save rather than after a rejected request.
  const invalidRows = useMemo(
    () =>
      studentMarks.filter((s) => {
        if (s.score === "") return false;
        const n = Number(s.score);
        return Number.isNaN(n) || n < 0 || (maxMarks > 0 && n > maxMarks);
      }),
    [studentMarks, maxMarks]
  );

  const gradedCount = studentMarks.filter((s) => s.score !== "").length;

  async function handleSave() {
    if (invalidRows.length > 0) {
      toast.error(
        `${invalidRows.length} score${invalidRows.length === 1 ? " is" : "s are"} outside 0–${maxMarks}. Fix ${invalidRows.length === 1 ? "it" : "them"} before saving.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: selectedAssessment,
          marks: studentMarks.map((s) => ({
            enrollmentId: s.enrollmentId,
            score: s.score,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't save marks");
      toast.success(
        `Saved ${json.saved ?? gradedCount} mark${(json.saved ?? gradedCount) === 1 ? "" : "s"}.`
      );
      // Re-read from the database so the table reflects what was actually stored.
      loadMarks();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedAssessmentObj = assessments.find(
    (a) => a.id === selectedAssessment
  );

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Grading</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block max-w-[250px]">
          Enter and update marks for a single assessment across the whole class.
        </p>
      </div>

      {/* ── Class + assessment pickers ─────────────────────────── */}
      <Card data-edge>
        <CardHeader>
          <CardTitle>Choose what to grade</CardTitle>
          <CardDescription>
            Pick a class, then the assessment you want to enter marks for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="class-select">Class</Label>
              <select
                id="class-select"
                value={selectedSC}
                onChange={(e) => setSelectedSC(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Select a class…</option>
                {sectionCourses.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.sections?.terms?.name} — Section {sc.sections?.name} (
                    {sc.courses?.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment-select">Assessment</Label>
              <select
                id="assessment-select"
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value)}
                disabled={!selectedSC}
                className={SELECT_CLASS}
              >
                <option value="">Select an assessment…</option>
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.type} · {a.max_marks} marks)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Marks table ────────────────────────────────────────── */}
      {selectedAssessment && (
        <Card data-edge>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{selectedAssessmentObj?.title}</CardTitle>
                <CardDescription>
                  {gradedCount} of {studentMarks.length} graded · out of{" "}
                  {maxMarks} marks
                </CardDescription>
              </div>
              <Button onClick={handleSave} disabled={isSaving || isLoading}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save marks
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or roll number"
                className="pl-9"
              />
            </div>

            {invalidRows.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {invalidRows.length} score
                  {invalidRows.length === 1 ? "" : "s"} outside the valid range
                  of 0–{maxMarks}. Correct the highlighted rows to save.
                </span>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : studentMarks.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No students are enrolled in this class yet. Sync a roster from
                the Roster &amp; Sync page to get started.
              </p>
            ) : filteredMarks.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No students match &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : (
              <div className="tams-table-wrap">
                <table className="tams-table">
                  <thead>
                    <tr>
                      <th>Roll number</th>
                      <th>Name</th>
                      <th className="tams-numeral">
                        Score (out of {maxMarks})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMarks.map((s) => {
                      const n = s.score === "" ? null : Number(s.score);
                      const isInvalid =
                        n !== null &&
                        (Number.isNaN(n) || n < 0 || (maxMarks > 0 && n > maxMarks));
                      return (
                        <tr
                          key={s.enrollmentId}
                        >
                          <td>
                            {s.rollNumber}
                          </td>
                          <td>{s.fullName}</td>
                          <td className="tams-numeral">
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min={0}
                              max={maxMarks}
                              value={s.score}
                              onChange={(e) =>
                                handleScoreChange(s.enrollmentId, e.target.value)
                              }
                              aria-label={`Score for ${s.fullName}`}
                              aria-invalid={isInvalid}
                              placeholder="—"
                              className={cn(
                                "ml-auto h-9 w-24 text-right font-mono",
                                isInvalid &&
                                  "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
