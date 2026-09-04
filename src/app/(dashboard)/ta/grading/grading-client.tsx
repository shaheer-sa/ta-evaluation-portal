"use client";

import { useState, useEffect, useMemo, useTransition, memo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { Loader2, Save, Search, AlertCircle, Eraser } from "lucide-react";
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

export interface StudentMark {
  enrollmentId: string;
  rollNumber: string;
  fullName: string;
  score: string;
}

export type SectionCourseRow = Pick<Database["public"]["Tables"]["section_courses"]["Row"], "id" | "section_id" | "course_id"> & {
  sections: (Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> & {
    terms: Pick<Database["public"]["Tables"]["terms"]["Row"], "name"> | null;
  }) | null;
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
};

export type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "type" | "max_marks" | "created_at">;

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

interface Props {
  sectionCourses: SectionCourseRow[];
  assessments: AssessmentRow[];
  initialStudentMarks: StudentMark[];
  selectedSC: string;
  selectedAssessment: string;
  maxMarks: number;
}

const MarkRow = memo(function MarkRow({
  enrollmentId,
  rollNumber,
  fullName,
  score,
  maxMarks,
  isInvalid,
  hasSavedMark,
  pendingClear,
  onChange,
  onToggleClear,
}: {
  enrollmentId: string;
  rollNumber: string;
  fullName: string;
  score: string;
  maxMarks: number;
  isInvalid: boolean;
  hasSavedMark: boolean;
  pendingClear: boolean;
  onChange: (id: string, val: string) => void;
  onToggleClear: (id: string) => void;
}) {
  return (
    <tr>
      <td className={pendingClear ? "line-through text-muted-foreground" : ""}>{rollNumber}</td>
      <td className={pendingClear ? "line-through text-muted-foreground" : ""}>
        {fullName}
        {pendingClear && <span className="ml-2 text-xs text-destructive rounded-full bg-destructive/10 px-2 py-0.5">will be removed</span>}
      </td>
      <td className="tams-numeral">
        <div className="flex items-center justify-end gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={maxMarks}
            value={score}
            onChange={(e) => onChange(enrollmentId, e.target.value)}
            disabled={pendingClear}
            aria-label={`Score for ${fullName}`}
            aria-invalid={isInvalid}
            placeholder="—"
            className={cn(
              "h-9 w-24 text-right font-mono",
              isInvalid && "border-destructive focus-visible:ring-destructive",
              pendingClear && "opacity-50"
            )}
          />
          {hasSavedMark && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleClear(enrollmentId)}
              className={cn("h-8 w-8", pendingClear ? "text-muted-foreground" : "text-destructive hover:bg-destructive/10 hover:text-destructive")}
              title={pendingClear ? "Restore mark" : "Clear this mark"}
            >
              {pendingClear ? <Save className="h-4 w-4" /> : <Eraser className="h-4 w-4" />}
            </Button>
          )}
          {/* Pad empty space if no clear button to keep input aligned */}
          {!hasSavedMark && <div className="h-8 w-8" />}
        </div>
      </td>
    </tr>
  );
});

export default function GradingClient({
  sectionCourses,
  assessments,
  initialStudentMarks,
  selectedSC,
  selectedAssessment,
  maxMarks,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>(initialStudentMarks);
  const [pendingClears, setPendingClears] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setStudentMarks(initialStudentMarks);
    setPendingClears(new Set());
    setIsDirty(false);
  }, [initialStudentMarks]);

  const initialByEnrollment = useMemo(
    () => new Map(initialStudentMarks.map((m) => [m.enrollmentId, m])),
    [initialStudentMarks]
  );

  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const handleScoreChange = useCallback((enrollmentId: string, value: string) => {
    setIsDirty(true);
    setStudentMarks((prev) =>
      prev.map((s) => (s.enrollmentId === enrollmentId ? { ...s, score: value } : s))
    );
  }, []);

  const handleToggleClear = useCallback((enrollmentId: string) => {
    setIsDirty(true);
    setPendingClears((prev) => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
        // Restore original score by finding it in initialStudentMarks
        const orig = initialByEnrollment.get(enrollmentId);
        if (orig) {
          setStudentMarks((marks) => marks.map((s) => (s.enrollmentId === enrollmentId ? { ...s, score: orig.score } : s)));
        }
      } else {
        next.add(enrollmentId);
        // Empty the input when pending clear
        setStudentMarks((marks) => marks.map((s) => (s.enrollmentId === enrollmentId ? { ...s, score: "" } : s)));
      }
      return next;
    });
  }, [initialByEnrollment]);

  const filteredMarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return studentMarks;
    return studentMarks.filter(
      (s) =>
        s.rollNumber.toLowerCase().includes(q) ||
        s.fullName.toLowerCase().includes(q)
    );
  }, [studentMarks, searchQuery]);

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

    const clearsArr = Array.from(pendingClears);
    if (pendingClears.size > 0) {
      if (!window.confirm(`Remove ${clearsArr.length} saved mark(s)? The next sync will also clear them from the Google Sheet.`)) {
        return;
      }
    }

    setIsSaving(true);
    try {
      const json = await fetchJson("/api/grading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: selectedAssessment,
          clearEnrollmentIds: Array.from(pendingClears),
          marks: studentMarks
            .filter((s) => !pendingClears.has(s.enrollmentId))
            .map((s) => ({
              enrollmentId: s.enrollmentId,
              score: s.score,
            })),
        }),
      });
      toast.success(
        `Saved ${json.saved ?? gradedCount} mark${(json.saved ?? gradedCount) === 1 ? "" : "s"}.`
      );
      
      setPendingClears(new Set());
      setIsDirty(false);
      router.refresh();
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
              <div className="flex items-center justify-between">
                <Label htmlFor="class-select">Class</Label>
                {isPending && <span className="tams-select__pending">Loading…</span>}
              </div>
              <select
                id="class-select"
                value={selectedSC}
                disabled={isPending}
                onChange={(e) => {
                  if (isDirty && !window.confirm("You have unsaved marks. Switch anyway and lose them?")) {
                    e.target.value = selectedSC;
                    return;
                  }
                  const val = e.target.value;
                  startTransition(() => {
                    if (val) {
                      router.push(`?sc=${val}`);
                    } else {
                      router.push(`/ta/grading`);
                    }
                  });
                }}
                className={SELECT_CLASS}
              >
                <option value="">Select a class…</option>
                {sectionCourses.map((sc) => {
                  const cName = sc.courses?.name || "";
                  const shortName = cName.length > 40 ? cName.slice(0, 39) + "…" : cName;
                  return (
                    <option key={sc.id} value={sc.id}>
                      {sc.sections?.terms?.name} — Section {sc.sections?.name} · {shortName} ({sc.courses?.code})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="assessment-select">Assessment</Label>
                {isPending && <span className="tams-select__pending">Loading…</span>}
              </div>
              <select
                id="assessment-select"
                value={selectedAssessment}
                disabled={!selectedSC || isPending}
                onChange={(e) => {
                  if (isDirty && !window.confirm("You have unsaved marks. Switch anyway and lose them?")) {
                    e.target.value = selectedAssessment;
                    return;
                  }
                  const val = e.target.value;
                  startTransition(() => {
                    if (val) {
                      router.push(`?sc=${selectedSC}&assessment=${val}`);
                    } else {
                      router.push(`?sc=${selectedSC}`);
                    }
                  });
                }}
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
              <div className="flex items-center">
                {isDirty && <span className="text-sm font-medium text-amber-500 mr-4">Unsaved changes</span>}
                <Button onClick={handleSave} disabled={isSaving || isPending}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save marks
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
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

            {studentMarks.length === 0 ? (
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
                      const orig = initialByEnrollment.get(s.enrollmentId);
                      const hasSavedMark = orig ? orig.score !== "" : false;
                      const pendingClear = pendingClears.has(s.enrollmentId);
                      return (
                        <MarkRow
                          key={s.enrollmentId}
                          enrollmentId={s.enrollmentId}
                          rollNumber={s.rollNumber}
                          fullName={s.fullName}
                          score={s.score}
                          maxMarks={maxMarks}
                          isInvalid={isInvalid}
                          hasSavedMark={hasSavedMark}
                          pendingClear={pendingClear}
                          onChange={handleScoreChange}
                          onToggleClear={handleToggleClear}
                        />
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
