"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
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
import { ResetPasswordButton } from "@/components/reset-password-button";
import type { Database } from "@/types/database";

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
  missingFromSheet?: { enrollmentId: string; rollNumber: string; fullName: string }[];
}

export type SectionCourseRow = Pick<Database["public"]["Tables"]["section_courses"]["Row"], "id" | "section_id" | "course_id"> & {
  sections: (Pick<Database["public"]["Tables"]["sections"]["Row"], "name"> & {
    terms: Pick<Database["public"]["Tables"]["terms"]["Row"], "name"> | null;
  }) | null;
  courses: Pick<Database["public"]["Tables"]["courses"]["Row"], "code" | "name"> | null;
};

export type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id" | "status"> & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "roll_number" | "full_name" | "email" | "must_change_password"> | null;
  marks: Pick<Database["public"]["Tables"]["marks"]["Row"], "assessment_id" | "score">[];
};

export type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "max_marks">;

interface Props {
  sections: SectionCourseRow[];
  selectedSectionCourseId: string;
  roster: EnrollmentRow[];
  assessments: AssessmentRow[];
}

export default function RosterClient({ sections, selectedSectionCourseId, roster, assessments }: Props) {
  const router = useRouter();
  const [sheetUrl, setSheetUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tams_google_sheet_url");
    if (saved) setSheetUrl(saved);
  }, []);

  // When selected section changes via props, we might want to clear syncResult if it was for a different section.
  // Actually, we do that onChange.

  async function handleSync() {
    if (!sheetUrl || !selectedSectionCourseId) return;
    
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

      setSyncResult(data as SyncResult);

      const parts: string[] = [];
      if (data.invited?.length) parts.push(`${data.invited.length} created`);
      if (data.existing?.length) parts.push(`${data.existing.length} already existed`);
      if (data.failed?.length) parts.push(`${data.failed.length} failed`);
      if (data.gradesWritten) parts.push("grades pushed to sheet");
      toast.success(parts.length ? parts.join(", ") : "Sync complete — nothing to do");

      // Replace refreshKey with router.refresh()
      router.refresh();
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
          <h1 className="tams-pagehead__title">Google Sync</h1>
        </div>
        <p className="text-sm text-muted-foreground text-right hidden sm:block max-w-[250px]">
          View enrolled students and perform a live two-way sync with Google Sheets.
        </p>
      </div>

      <Card data-edge>
        <CardHeader>
          <CardTitle>Select Class & Sync</CardTitle>
          <CardDescription>
            Choose a section to sync its data with your instructor&apos;s Google Sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Section & Course</Label>
            <select
              value={selectedSectionCourseId}
              onChange={(e) => {
                setSyncResult(null);
                const val = e.target.value;
                if (val) {
                  router.push(`?sc=${val}`);
                } else {
                  router.push(`/ta/roster`);
                }
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
                    New accounts get the password Tams@&lt;roll-number&gt; and must change it on first login.
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
                <h4 className="font-medium text-sm text-primary mb-2">
                  Created ({syncResult.invited.length})
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

            {syncResult.missingFromSheet && syncResult.missingFromSheet.length > 0 && (
              <MissingStudentsPanel 
                missingStudents={syncResult.missingFromSheet} 
                onWithdrawComplete={() => {
                  setSyncResult(prev => prev ? { ...prev, missingFromSheet: [] } : null);
                  router.refresh();
                }} 
              />
            )}
          </CardContent>
        </Card>
      )}

      {selectedSectionCourseId && (
        <Card data-edge>
          <CardHeader>
            <CardTitle>Current List</CardTitle>
          </CardHeader>
          <CardContent>
            {roster.length === 0 ? (
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
                      <th className="whitespace-nowrap">Status</th>
                      {assessments.map(a => (
                        <th key={a.id} className="whitespace-nowrap tams-numeral">
                          {a.title} ({a.max_marks})
                        </th>
                      ))}
                      <th className="whitespace-nowrap"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.filter(r => r.status === "active").map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{r.profiles?.roll_number}</td>
                        <td className="whitespace-nowrap">{r.profiles?.full_name}</td>
                        <td className="whitespace-nowrap">
                          {r.profiles?.email}
                        </td>
                        <td className="whitespace-nowrap">
                          {r.profiles?.must_change_password === true ? (
                            <span className="tams-pill" data-tone="open">Not logged in yet</span>
                          ) : (
                            <span className="tams-pill" data-tone="done">Active</span>
                          )}
                        </td>
                        {assessments.map(a => {
                          const mark = r.marks.find((m) => m.assessment_id === a.id);
                          return (
                            <td key={a.id} className="tams-numeral">
                              {mark ? mark.score : "-"}
                            </td>
                          )
                        })}
                        <td className="whitespace-nowrap text-right">
                          {r.profiles?.id && r.profiles?.roll_number && r.profiles?.full_name && (
                            <ResetPasswordButton
                              studentId={r.profiles.id}
                              studentName={r.profiles.full_name}
                              rollNumber={r.profiles.roll_number}
                              onSuccess={() => router.refresh()}
                            />
                          )}
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

      {selectedSectionCourseId && roster.filter(r => r.status === "withdrawn").length > 0 && (
        <Card data-edge>
          <CardHeader>
            <CardTitle className="text-muted-foreground">Withdrawn ({roster.filter(r => r.status === "withdrawn").length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tams-table-wrap opacity-75">
              <table className="tams-table">
                <thead>
                  <tr>
                    <th className="whitespace-nowrap">Roll Number</th>
                    <th className="whitespace-nowrap">Name</th>
                    <th className="whitespace-nowrap">Status</th>
                    <th className="whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {roster.filter(r => r.status === "withdrawn").map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{r.profiles?.roll_number}</td>
                      <td className="whitespace-nowrap">{r.profiles?.full_name}</td>
                      <td className="whitespace-nowrap">
                        <span className="tams-pill" data-tone="late">Withdrawn</span>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/admin/enrollments/withdraw", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  enrollmentIds: [r.id],
                                  status: "active"
                                })
                              });
                              if (!res.ok) throw new Error("Failed to reactivate");
                              toast.success("Student reactivated");
                              router.refresh();
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Error");
                            }
                          }}
                        >
                          Reactivate
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MissingStudentsPanel({ 
  missingStudents, 
  onWithdrawComplete 
}: { 
  missingStudents: { enrollmentId: string; rollNumber: string; fullName: string }[];
  onWithdrawComplete: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(missingStudents.map(s => s.enrollmentId)));
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    if (selectedIds.size === 0) return;
    setIsWithdrawing(true);
    try {
      const res = await fetch("/api/admin/enrollments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentIds: Array.from(selectedIds),
          status: "withdrawn"
        })
      });
      if (!res.ok) throw new Error("Failed to withdraw students");
      toast.success("Students withdrawn successfully.");
      onWithdrawComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error withdrawing students");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div 
      className="mt-6 rounded-md border p-4" 
      style={{ backgroundColor: 'var(--warning-soft, #fffbeb)', borderColor: 'var(--warning, #f59e0b)', color: 'var(--warning, #b45309)' }}
    >
      <h4 className="font-semibold flex items-center gap-2 mb-3">
        <AlertCircle className="h-5 w-5" />
        {missingStudents.length} student{missingStudents.length === 1 ? ' is' : 's are'} enrolled in TAMS but not in the sheet.
      </h4>
      
      <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto bg-white/50 p-2 rounded border border-white/20">
        {missingStudents.map(s => (
          <div key={s.enrollmentId} className="flex items-center gap-2 text-sm text-black">
            <input 
              type="checkbox" 
              className="rounded"
              checked={selectedIds.has(s.enrollmentId)}
              onChange={(e) => {
                const next = new Set(selectedIds);
                if (e.target.checked) next.add(s.enrollmentId);
                else next.delete(s.enrollmentId);
                setSelectedIds(next);
              }}
            />
            <span className="font-mono text-muted-foreground">{s.rollNumber}</span>
            <span className="font-medium">{s.fullName}</span>
          </div>
        ))}
      </div>
      
      <p className="text-sm font-medium opacity-90 mb-4 max-w-2xl">
        Withdrawn students keep their grades and can still sign in to view them, 
        but are removed from the roster, analytics, and sheet sync.
      </p>
      
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={handleWithdraw} 
          disabled={isWithdrawing || selectedIds.size === 0}
          className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border-red-200"
        >
          {isWithdrawing ? "Processing..." : "Mark selected as withdrawn"}
        </Button>
        <Button 
          variant="ghost"
          onClick={() => onWithdrawComplete()} 
          disabled={isWithdrawing}
          style={{ color: 'var(--warning, #b45309)' }}
          className="hover:bg-black/5"
        >
          Keep all
        </Button>
      </div>
    </div>
  );
}
