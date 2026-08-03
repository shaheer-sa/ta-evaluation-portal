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

export default function RosterPage() {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionCourseId, setSelectedSectionCourseId] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [roster, setRoster] = useState<any[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [assessments, setAssessments] = useState<any[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Fetch all mapped sections
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("section_courses")
        .select(`
          id,
          sections ( name, terms ( name ) ),
          courses ( code, name )
        `);
      if (data) setSections(data);
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

      const mapped = sections.find((s) => s.id === selectedSectionCourseId);
      if (!mapped) return;

      // Fetch assessments for this section_course
      const { data: assessData } = await supabase
        .from("assessments")
        .select("id, title, max_marks")
        .eq("section_course_id", selectedSectionCourseId)
        .order("created_at", { ascending: true });
      if (assessData) setAssessments(assessData);

      // Fetch enrollments with marks
      const { data } = await supabase
        .from("enrollments")
        .select(`
          id,
          profiles:student_id ( roll_number, full_name, email ),
          marks ( assessment_id, score )
        `)
        .eq("section_id", mapped.sections.id)
        .eq("course_id", mapped.courses.id);

      if (data) setRoster(data);
      setIsLoadingRoster(false);
    }

    fetchRoster();
  }, [selectedSectionCourseId, sections, supabase]);

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

      // Reload roster data without full page reload
      setSelectedSectionCourseId(prev => {
        const val = prev;
        setTimeout(() => setSelectedSectionCourseId(val), 0);
        return "";
      });
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roster & Google Sync</h1>
        <p className="text-muted-foreground">
          View enrolled students and perform a live two-way sync with Google Sheets.
        </p>
      </div>

      <Card>
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
                  {s.sections.terms.name} — Section {s.sections.name} ({s.courses.code})
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
                  <li>Any new students in the sheet will be invited to TAMS.</li>
                  <li>Any grades recorded in TAMS will be pushed to the sheet automatically.</li>
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
        <Card>
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
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm border-b last:border-0">
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
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm border-b last:border-0">
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
                    <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm border-b last:border-0">
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
        <Card>
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
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium whitespace-nowrap">Roll Number</th>
                      <th className="p-3 text-left font-medium whitespace-nowrap">Name</th>
                      <th className="p-3 text-left font-medium whitespace-nowrap">Email</th>
                      {assessments.map(a => (
                        <th key={a.id} className="p-3 text-left font-medium whitespace-nowrap">
                          {a.title} ({a.max_marks})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 font-mono whitespace-nowrap">{r.profiles?.roll_number}</td>
                        <td className="p-3 whitespace-nowrap">{r.profiles?.full_name}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {r.profiles?.email}
                        </td>
                        {assessments.map(a => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const mark = r.marks.find((m: any) => m.assessment_id === a.id);
                          return (
                            <td key={a.id} className="p-3 text-center">
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
