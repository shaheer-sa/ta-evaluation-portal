"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
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

interface StudentMark {
  enrollmentId: string;
  rollNumber: string;
  fullName: string;
  score: string;
}

export default function GradingPage() {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sectionCourses, setSectionCourses] = useState<any[]>([]);
  const [selectedSC, setSelectedSC] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [maxMarks, setMaxMarks] = useState(0);

  // Load section-courses
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("section_courses")
        .select(`id, sections ( name, terms ( name ) ), courses ( code, name )`);
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

    const assessment = assessments.find((a) => a.id === selectedAssessment);
    if (assessment) setMaxMarks(assessment.max_marks);

    const sc = sectionCourses.find((s) => s.id === selectedSC);
    if (!sc) return;

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select(`
        id,
        profiles:student_id ( roll_number, full_name ),
        marks ( assessment_id, score )
      `)
      .eq("section_id", sc.sections.id)
      .eq("course_id", sc.courses.id);

    if (enrollments) {
      const mapped: StudentMark[] = enrollments.map((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mark = e.marks.find((m: any) => m.assessment_id === selectedAssessment);
        return {
          enrollmentId: e.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rollNumber: (e.profiles as any)?.roll_number || "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fullName: (e.profiles as any)?.full_name || "",
          score: mark ? String(mark.score) : "",
        };
      });
      // Sort by roll number
      mapped.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
      setStudentMarks(mapped);
    }
    setIsLoading(false);
  }, [selectedAssessment, selectedSC, assessments, sectionCourses, supabase]);

  useEffect(() => {
    loadMarks();
  }, [loadMarks]);

  function handleScoreChange(index: number, value: string) {
    setStudentMarks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], score: value };
      return next;
    });
  }

  async function handleSave() {
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
      if (!res.ok) throw new Error(json.error || "Failed to save");
      toast.success("Marks saved successfully!");
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grading</h1>
        <p className="text-muted-foreground">
          Enter and edit student marks for each assessment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Assessment</CardTitle>
          <CardDescription>
            Pick a class and assessment to begin grading.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                value={selectedSC}
                onChange={(e) => setSelectedSC(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select...</option>
                {sectionCourses.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.sections.terms.name} — Sec {sc.sections.name} ({sc.courses.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Assessment</Label>
              <select
                value={selectedAssessment}
                onChange={(e) => setSelectedAssessment(e.target.value)}
                disabled={!selectedSC}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">Select...</option>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Enter Marks</CardTitle>
              <CardDescription>Max: {maxMarks} marks</CardDescription>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save All
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : studentMarks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students enrolled in this class.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium w-12">#</th>
                      <th className="p-3 text-left font-medium">Roll Number</th>
                      <th className="p-3 text-left font-medium">Name</th>
                      <th className="p-3 text-left font-medium w-32">
                        Score (/{maxMarks})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentMarks.map((s, i) => (
                      <tr
                        key={s.enrollmentId}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-mono">{s.rollNumber}</td>
                        <td className="p-3">{s.fullName}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxMarks}
                            value={s.score}
                            onChange={(e) =>
                              handleScoreChange(i, e.target.value)
                            }
                            className="h-8 w-24"
                          />
                        </td>
                      </tr>
                    ))}
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
