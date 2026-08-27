"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, UserPlus } from "lucide-react";
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

interface SyncStudentResult {
  email: string;
  rollNumber: string;
  fullName: string;
  outcome: "invited" | "existing" | "failed";
  detail?: string;
}

interface SyncResult {
  invited: SyncStudentResult[];
  existing: SyncStudentResult[];
  failed: SyncStudentResult[];
  gradesWritten: boolean;
  totalProcessed: number;
}

import type { Database } from "@/types/database";

type SectionCourseRow = Pick<Database["public"]["Tables"]["section_courses"]["Row"], "id" | "section_id" | "course_id"> & {
  sections: (Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> & {
    terms: Pick<Database["public"]["Tables"]["terms"]["Row"], "name"> | null;
  }) | null;
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
};

type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id"> & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "roll_number" | "full_name" | "email"> | null;
  marks: Pick<Database["public"]["Tables"]["marks"]["Row"], "assessment_id" | "score">[];
};

type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "max_marks">;

export default function RosterPage() {
  const supabase = createClient();
  const [sections, setSections] = useState<SectionCourseRow[]>([]);
  const [selectedSectionCourseId, setSelectedSectionCourseId] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [roster, setRoster] = useState<EnrollmentRow[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  // Bumped after a sync to re-run the roster fetch without clearing the
  // current selection (which used to blank the table mid-render).
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch all mapped sections
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("section_courses")
        .select(`
          id,
          section_id,
          course_id,
          sections ( name, terms ( name ) ),
          courses ( code, name )
        `);
      if (data) setSections(data as unknown as SectionCourseRow[]);
    }
    load();
    
    // Load saved sheet URL from local storage if exists
    const saved = localStorage.getItem("tams_google_sheet_url");
    if (saved) setSheetUrl(saved);
  }, [supabase]);

  // Fetch roster when selection changes
  useEffect(() => {
    async function fetchRoster() {
      if (!selectedSectionCourseId) {
        setRoster([]);
        setAssessments([]);
        return;
      }
      setIsLoadingRoster(true);

      try {
        const mapped = sections.find((s) => s.id === selectedSectionCourseId);
        // `sections` may not have loaded yet on first paint. The old code
        // returned here without clearing the loading flag, leaving the
        // spinner turning forever with no way to recover but a page reload.
        if (!mapped) {
          setRoster([]);
          return;
        }

        // Fetch assessments for this section_course
        const { data: assessData } = await supabase
          .from("assessments")
          .select("id, title, max_marks")
          .eq("section_course_id", selectedSectionCourseId)
          .order("created_at", { ascending: true });
        setAssessments(assessData || []);

        // Fetch enrollments with marks
        const { data, error } = await supabase
          .from("enrollments")
          .select(`
            id,
            profiles:student_id ( roll_number, full_name, email ),
            marks ( assessment_id, score )
          `)
          .eq("section_id", mapped.section_id)
          .eq("course_id", mapped.course_id);

        if (error) {
          toast.error("Couldn't load the roster.");
          setRoster([]);
          return;
        }

        setRoster(data as unknown as EnrollmentRow[]);
      } finally {
        setIsLoadingRoster(false);
      }
    }

    fetchRoster();
  }, [selectedSectionCourseId, sections, supabase, refreshKey]);

  async function handleSync() {
    if (!sheetUrl || !selectedSectionCourseId) return;
    
    // Basic URL validation
    if (!sheetUrl.includes("docs.google.com/spreadsheets/d/")) {
      toast.error("Invalid Google Sheets URL.");
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    localStorage.setItem("tams_google_sheet_url", sheetUrl);

    try {
      const res = await fetch("/api/sync/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionCourseId: selectedSectionCourseId,
          spreadsheetUrl: sheetUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      // Set the structured result for display
      setSyncResult(data as SyncResult);

      // Summary toast
      const parts: string[] = [];
      if (data.invited?.length) parts.push(`${data.invited.length} invited`);
      if (data.existing?.length) parts.push(`${data.existing.length} already existed`);
      if (data.failed?.length) parts.push(`${data.failed.length} failed`);
      if (data.gradesWritten) parts.push("grades pushed to sheet");
      toast.success(parts.length ? parts.join(", ") : "Sync complete — nothing to do");

      // Reload roster data without a full page reload. The previous version
      // called setState from inside a state updater via setTimeout, which
      // React warns about and which briefly blanked the selection (and with
      // it the results table the TA had just been shown).
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="tams-pagehead">
        <div>
          <p className="tams-pagehead__eyebrow">TEACHING ASSISTANT</p>
          <h1 className="tams-pagehead__title">Roster & Google Sync</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block max-w-[250px]">
          View enrolled students and perform a live two-way sync with Google Sheets.
        </p>
      </div>

      <Card data-edge>
        <CardHeader>
          <CardTitle>Select Class & Sync</CardTitle>
          <CardDescription>
            Choose a mapped section to sync its data with your instructor&apos;s Google Sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Section & Course</Label>
            <select
              value={selectedSectionCourseId}
              onChange={(e) => {
                setSelectedSectionCourseId(e.target.value);
                setSyncResult(null);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select...</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.sections?.terms?.name || "Term"} - ${s.sections?.name || "Sec"} (${s.courses?.code || "Code"})`}
                </option>
              ))}
            </select>
          </div>

          {selectedSectionCourseId && (
            <div className="rounded-lg border bg-muted/20 p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Live Google Sheets Sync
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste the full URL of the Google Sheet. When you click Sync:
                </p>
                <ul className="list-disc list-inside mt-2 ml-1 text-xs text-muted-foreground">
                  <li>Any new students in the sheet get a TAMS account.</li>
                  <li>Any grades recorded in TAMS are pushed to the sheet automatically.</li>
                  <li>
                    New accounts have no usable password — students set one
                    themselves via <strong>Forgot password</strong> on the
                    login page.
                  </li>
                </ul>
              </div>
              <div className="flex gap-4">
                <Input 
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0Xra..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSync}
                  disabled={!sheetUrl || isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sync Result Breakdown ──────────────────────────────────── */}
      {syncResult && (
        <Card data-edge>
          <CardHeader>
            <CardTitle className="text-lg">Sync Results</CardTitle>
            <CardDescription>
              {syncResult.totalProcessed} student{syncResult.totalProcessed !== 1 ? "s" : ""} processed
              {syncResult.gradesWritten && " — grades updated in Google Sheet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncResult.invited.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <UserPlus className="h-4 w-4 text-green-600" />
                  Invited ({syncResult.invited.length})
                </h4>
                <div className="rounded-md border">
                  {syncResult.invited.map((s, i) => (
                    <div key={i} className="tams-inset flex items-center gap-3 px-3 py-2 text-sm mb-2 last:mb-0">
                      <span className="font-mono text-xs">{s.rollNumber}</span>
                      <span>{s.fullName}</span>
                      <span className="text-muted-foreground text-xs ml-auto">{s.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {syncResult.existing.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  Already existed ({syncResult.existing.length})
                </h4>
                <div className="rounded-md border">
                  {syncResult.existing.map((s, i) => (
                    <div key={i} className="tams-inset flex items-center gap-3 px-3 py-2 text-sm mb-2 last:mb-0">
                      <span className="font-mono text-xs">{s.rollNumber}</span>
                      <span>{s.fullName}</span>
                      <span className="text-muted-foreground text-xs ml-auto">{s.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {syncResult.failed.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Failed ({syncResult.failed.length})
                </h4>
                <div className="rounded-md border border-red-200">
                  {syncResult.failed.map((s, i) => (
                    <div key={i} className="tams-inset flex items-center gap-3 px-3 py-2 text-sm mb-2 last:mb-0">
                      <span className="font-mono text-xs">{s.rollNumber}</span>
                      <span>{s.fullName}</span>
                      <span className="text-red-600 text-xs ml-auto">{s.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Current Roster Table ──────────────────────────────────── */}
      {selectedSectionCourseId && (
        <Card data-edge>
          <CardHeader>
            <CardTitle>Current Roster</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRoster ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students enrolled in this section yet. Click Sync above to pull them from Google Sheets!
              </p>
            ) : (
              <div className="tams-table-wrap">
                <table className="tams-table">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">Roll Number</th>
                      <th className="whitespace-nowrap">Name</th>
                      <th className="whitespace-nowrap">Email</th>
                      {assessments.map(a => (
                        <th key={a.id} className="whitespace-nowrap tams-numeral">
                          {a.title} ({a.max_marks})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{r.profiles?.roll_number}</td>
                        <td className="whitespace-nowrap">{r.profiles?.full_name}</td>
                        <td className="whitespace-nowrap">
                          {r.profiles?.email}
                        </td>
                        {assessments.map(a => {
                          const mark = r.marks.find((m) => m.assessment_id === a.id);
                          return (
                            <td key={a.id} className="tams-numeral">
                              {mark ? mark.score : "-"}
                            </td>
                          )
                        })}
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
