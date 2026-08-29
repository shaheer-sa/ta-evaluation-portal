import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { escapeLikePattern } from "@/lib/identifiers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { createRateLimiter } from "@/lib/rate-limit";
import { runInBatches } from "@/lib/batch";

export const maxDuration = 60;

const syncRateLimit = createRateLimiter({ tokens: 5, window: "10 m" });

// ── Types for the structured sync result ────────────────────────────

interface SyncStudentResult {
  email: string;
  rollNumber: string;
  fullName: string;
  outcome: "invited" | "existing" | "enrolled" | "failed";
  detail?: string;
}

export interface SyncResponse {
  invited: SyncStudentResult[];
  existing: SyncStudentResult[];
  failed: SyncStudentResult[];
  rejectedScores?: { rollNo: string; assessment: string; value: string; reason: string }[];
  skippedAssessments?: string[];
  gradesWritten: boolean;
  totalProcessed: number;
  missingFromSheet?: { enrollmentId: string; rollNumber: string; fullName: string }[];
}

// ── Utility: Generate Email from Roll Number ────────────────────────

// Institution email domain. Configurable so the app isn't welded to one
// university -- set STUDENT_EMAIL_DOMAIN in .env.local to override.
const STUDENT_EMAIL_DOMAIN =
  process.env.STUDENT_EMAIL_DOMAIN || "cfd.nu.edu.pk";

function generateEmail(rollNo: string): string {
  // Format: 25F-0510 -> f250510@<domain>
  const match = rollNo.match(/^(\d+)([a-zA-Z])-(.+)$/);
  if (match) {
    return `${match[2].toLowerCase()}${match[1]}${match[3].replace(/\D/g, "")}@${STUDENT_EMAIL_DOMAIN}`;
  }
  // Fallback
  const clean = rollNo.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${clean}@${STUDENT_EMAIL_DOMAIN}`;
}

function generateInitialPassword(rollNumber: string): string {
  return `Tams@${rollNumber}`;
}

// ── Utility: Match Assessment Type to Sheet Tab ──────────────────────

function findMatchingTab(type: string, tabMap: Map<string, string>): string | null {
  const t = type.toLowerCase();
  
  // Custom exact matching for common typos and aliases
  if (t.includes('quiz') || t.includes('quizz')) {
    for (const [key, value] of tabMap.entries()) {
      if (key.includes('quiz')) return value;
    }
  }
  
  if (t.includes('assign')) {
    for (const [key, value] of tabMap.entries()) {
      if (key.includes('assign')) return value;
    }
  }

  for (const [key, value] of tabMap.entries()) {
    if (key.includes(t)) return value;
    if (t === 'mid' && (key.includes('mid') || key.includes('sessional-1') || key.includes('sessional-i'))) return value;
    if (t === 'final' && (key.includes('final') || key.includes('sessional-2') || key.includes('sessional-ii'))) return value;
  }
  return null;
}

function validateScore(raw: string, maxMarks: number):
  { ok: true; value: number } | { ok: false; reason: string } {
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return { ok: false, reason: "not a plain number" };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, reason: "not a number" };
  if (n < 0) return { ok: false, reason: "negative" };
  if (maxMarks > 0 && n > maxMarks) return { ok: false, reason: `above max ${maxMarks}` };
  return { ok: true, value: n };
}

// ── Main handler ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Ensure caller is a TA
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "ta") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (syncRateLimit) {
      const { success, reset } = await syncRateLimit.limit(`sync-google:${user.id}`);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: "Too many sync attempts, please wait before trying again." },
          { 
            status: 429,
            headers: { "Retry-After": retryAfter.toString() }
          }
        );
      }
    }

    const { sectionCourseId, spreadsheetUrl } = await request.json();

    if (!sectionCourseId || !spreadsheetUrl) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Extract Spreadsheet ID from URL
    const spreadsheetIdMatch = spreadsheetUrl.match(/[-\w]{25,}/);
    if (!spreadsheetIdMatch) {
      return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
    }
    const spreadsheetId = spreadsheetIdMatch[0];

    // Check for Google Credentials
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Google Service Account credentials missing in .env.local" },
        { status: 500 }
      );
    }

    // Authenticate with Google API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 1. Fetch spreadsheet metadata to dynamically map tabs
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = spreadsheet.data.sheets || [];
    if (sheetList.length === 0) {
      return NextResponse.json({ error: "Spreadsheet has no sheets" }, { status: 400 });
    }

    // Default roster tab is the very first one
    const firstSheetName = sheetList[0].properties?.title || "Sheet1";
    
    const tabMap = new Map<string, string>();
    for (const s of sheetList) {
      if (s.properties?.title) {
        tabMap.set(s.properties.title.toLowerCase(), s.properties.title);
      }
    }

    // 2. Fetch Roster from the first tab
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: firstSheetName,
    });

    const rows = sheetData.data.values || [];
    if (rows.length < 5) {
      return NextResponse.json({ error: "Spreadsheet does not have the expected 4 rows of metadata headers before student data." }, { status: 400 });
    }

    // The student headers are on Row 4 (index 3)
    const headers = rows[3].map((h: string) => h.toLowerCase().trim().replace(/ /g, "_"));
    const rollNumIdx = headers.indexOf("rollno") !== -1 ? headers.indexOf("rollno") : headers.indexOf("roll_number");
    const nameIdx = headers.indexOf("name") !== -1 ? headers.indexOf("name") : headers.indexOf("full_name");

    if (rollNumIdx === -1 || nameIdx === -1) {
      return NextResponse.json(
        { error: "Spreadsheet Row 4 must contain headers for RollNo and Name" },
        { status: 400 }
      );
    }

    // Get section and course details
    const { data: mapped } = await supabase
      .from("section_courses")
      .select("section_id, course_id")
      .eq("id", sectionCourseId)
      .single();

    if (!mapped) {
      return NextResponse.json({ error: "Mapped section not found" }, { status: 404 });
    }

    // Get assessments
    const { data: assessments } = await supabase
      .from("assessments")
      .select("id, title, type, max_marks, created_at")
      .eq("section_course_id", sectionCourseId);

    const admin = createAdminClient();

    // 3. Parse student rows (starting at Row 5, index 4)
    const studentRows = rows.slice(4).filter(row => row[rollNumIdx]);
    const parsedStudents = studentRows.map(row => {
      const rollNumber = row[rollNumIdx]?.trim() || "";
      return {
        email: generateEmail(rollNumber),
        roll_number: rollNumber,
        full_name: row[nameIdx]?.trim() || "",
      };
    });

    // 4. Invite/enroll students in batches of 5
    const BATCH_SIZE = 5;

    const results = await runInBatches(parsedStudents, BATCH_SIZE, async (student): Promise<SyncStudentResult> => {
      try {
        let studentId = "";

        // Silently create the user without sending an invite email
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: student.email,
          email_confirm: true,
          password: generateInitialPassword(student.roll_number),
          user_metadata: {
            roll_number: student.roll_number,
            full_name: student.full_name,
          },
        });

        if (authError) {
          // Two separate equality lookups instead of a single .or() built by
          // string interpolation. The old version spliced raw spreadsheet
          // cells straight into a PostgREST filter expression, so a roll
          // number containing a comma, dot or parenthesis could rewrite the
          // filter and match the wrong student -- or every student.
          const { data: byEmail } = await admin
            .from("profiles")
            .select("id")
            .eq("email", student.email)
            .maybeSingle();

          let existingProfile = byEmail;

          if (!existingProfile && student.roll_number) {
            const { data: byRoll } = await admin
              .from("profiles")
              .select("id")
              .ilike("roll_number", escapeLikePattern(student.roll_number))
              .maybeSingle();
            existingProfile = byRoll;
          }

          if (existingProfile) {
            studentId = existingProfile.id;
          } else {
            return {
              email: student.email,
              rollNumber: student.roll_number,
              fullName: student.full_name,
              outcome: "failed",
              detail: authError.message,
            };
          }
        } else {
          studentId = authData.user.id;
          
          await admin
            .from("profiles")
            .update({ must_change_password: true })
            .eq("id", authData.user.id);
        }

        const { error: enrollError } = await admin.from("enrollments").insert({
          student_id: studentId,
          section_id: mapped.section_id,
          course_id: mapped.course_id,
        });

        if (enrollError && enrollError.code !== "23505") {
          return {
            email: student.email,
            rollNumber: student.roll_number,
            fullName: student.full_name,
            outcome: "failed",
            detail: `Enrolled in auth but enrollment insert failed: ${enrollError.message}`,
          };
        }

        if (authError) {
          return {
            email: student.email,
            rollNumber: student.roll_number,
            fullName: student.full_name,
            outcome: "existing",
            detail: enrollError?.code === "23505" ? "Already enrolled" : "Account existed, now enrolled",
          };
        }

        return {
          email: student.email,
          rollNumber: student.roll_number,
          fullName: student.full_name,
          outcome: "invited",
        };
      } catch (err: unknown) {
        return {
          email: student.email,
          rollNumber: student.roll_number,
          fullName: student.full_name,
          outcome: "failed",
          detail: err instanceof Error ? err.message : "Unknown error",
        };
      }
    });

    // 4.5 Fetch all active enrollments for this section_course to detect missing students and sync marks
    type AssessmentRow = Pick<Database["public"]["Tables"]["assessments"]["Row"], "id" | "title" | "type" | "max_marks" | "created_at">;
    type EnrollmentRow = Pick<Database["public"]["Tables"]["enrollments"]["Row"], "id"> & {
      profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "email" | "roll_number" | "full_name"> | null;
      marks: Pick<Database["public"]["Tables"]["marks"]["Row"], "id" | "assessment_id" | "score" | "sheet_synced_score">[];
    };

    const { data: rawEnrollments } = await admin
      .from("enrollments")
      .select(`
        id,
        profiles:student_id ( email, roll_number, full_name ),
        marks ( id, assessment_id, score, sheet_synced_score )
      `)
      .eq("section_id", mapped.section_id)
      .eq("course_id", mapped.course_id)
      .eq("status", "active"); // Step 5b: exclude withdrawn students

    const currentEnrollments = rawEnrollments as unknown as EnrollmentRow[] | null;

    // Detect students missing from the sheet
    // We explicitly skip detection if parsedStudents is empty. 
    // An empty parse almost always means the tab name changed or the Google API call failed, 
    // not that the entire class withdrew. Without this guard, one transient API error would 
    // show the TA a pre-checked prompt to withdraw every student in the section.
    let missingFromSheet: { enrollmentId: string; rollNumber: string; fullName: string }[] = [];

    if (parsedStudents.length > 0 && currentEnrollments) {
      const sheetRollNumbers = new Set(parsedStudents.map(s => s.roll_number.toLowerCase()));
      missingFromSheet = currentEnrollments
        .filter(e => e.profiles?.roll_number && !sheetRollNumbers.has(e.profiles.roll_number.toLowerCase()))
        .map(e => ({
          enrollmentId: e.id,
          rollNumber: e.profiles!.roll_number || "",
          fullName: e.profiles!.full_name || "",
        }));
    }

    // 5. Push TAMS marks back to Google Sheets across multiple tabs
    let gradesWritten = false;
    const rejectedScores: { rollNo: string; assessment: string; value: string; reason: string }[] = [];
    const skippedAssessments: string[] = [];

    if (assessments && assessments.length > 0) {
      if (currentEnrollments) {
        // Group assessments by their matching tab
        const tabToAssessments = new Map<string, AssessmentRow[]>();
        for (const assessment of assessments) {
          const tabName = findMatchingTab(assessment.type, tabMap);
          if (!tabName) {
            skippedAssessments.push(assessment.title);
            continue;
          }
          if (!tabToAssessments.has(tabName)) tabToAssessments.set(tabName, []);
          tabToAssessments.get(tabName)!.push(assessment);
        }

        // Collect marks to upsert into Supabase after we read everything
        const marksToUpsert: Database["public"]["Tables"]["marks"]["Insert"][] = [];

        for (const [tabName, tabAssessments] of tabToAssessments.entries()) {
          const tabData = await sheets.spreadsheets.values.get({ spreadsheetId, range: tabName });
          const tabRows = tabData.data.values || [];
          
          if (tabRows.length < 5) {
             while (tabRows.length < 5) tabRows.push([]);
          }

          const tabHeaders = (tabRows[3] || []).map((h: string) => h?.toLowerCase().trim().replace(/ /g, "_") || "");
          const tabRollNumIdx = tabHeaders.indexOf("rollno") !== -1 ? tabHeaders.indexOf("rollno") : tabHeaders.indexOf("roll_number");
          
          if (tabRollNumIdx === -1) continue; 

          let sheetUpdated = false;

          for (const assessment of tabAssessments) {
            let colIdx = -1;
            // 1st row contains the Assessment Name (e.g. 'Quiz 1')
            for (let i = 0; i < tabRows[0].length; i++) {
              if (tabRows[0][i]?.trim().toLowerCase() === assessment.title.trim().toLowerCase()) {
                colIdx = i;
                break;
              }
            }

            if (colIdx === -1) {
              colIdx = Math.max((tabRows[0] || []).length, (tabRows[3] || []).length);
              for (let i = 0; i < 4; i++) {
                if (!tabRows[i]) tabRows[i] = [];
                while (tabRows[i].length <= colIdx) tabRows[i].push("");
              }
              tabRows[0][colIdx] = assessment.title;
              const dateStr = new Date(assessment.created_at).toLocaleDateString("en-US");
              tabRows[1][colIdx] = dateStr;
              tabRows[2][colIdx] = ""; 
              tabRows[3][colIdx] = String(assessment.max_marks);
              sheetUpdated = true;
            }

            for (let i = 4; i < tabRows.length; i++) {
              if (!tabRows[i]) tabRows[i] = [];
              const row = tabRows[i];
              const rollNo = row[tabRollNumIdx]?.trim();
              if (!rollNo) continue;

              const email = generateEmail(rollNo);
              const enrollment = currentEnrollments.find(e => {
                const p = e.profiles;
                return p?.roll_number?.toLowerCase() === rollNo.toLowerCase() || p?.email === email;
              });
              
              if (enrollment) {
                const existingMark = enrollment.marks.find((m) => m.assessment_id === assessment.id);
                // We don't necessarily use existingMark here but it checks if it exists.
                if (existingMark) { /* ... */ }
                
                // Parse sheet score safely
                const sheetScoreStr = (row[colIdx] || "").toString().trim();
                let sheetScore: number | null = null;
                let cellRejected = false;

                if (sheetScoreStr !== "") {
                  const valRes = validateScore(sheetScoreStr, Number(assessment.max_marks));
                  if (valRes.ok) {
                    sheetScore = valRes.value;
                  } else {
                    cellRejected = true;
                    rejectedScores.push({
                      rollNo,
                      assessment: assessment.title,
                      value: sheetScoreStr,
                      reason: valRes.reason,
                    });
                  }
                }

                // A cell we refused to READ is a cell we must not WRITE. Leave it untouched
                // so the TA can find and correct their own value in the sheet.
                if (cellRejected) continue;

                if (existingMark) {
                  const tamsScore = existingMark.score !== null ? Number(existingMark.score) : null;
                  const syncedScore = existingMark.sheet_synced_score !== null ? Number(existingMark.sheet_synced_score) : null;

                  if (tamsScore !== syncedScore) {
                     // 1. TAMS was modified locally. Push to sheet.
                     while (row.length <= colIdx) row.push("");
                     const writeVal = tamsScore !== null ? String(tamsScore) : "";
                     if (row[colIdx] !== writeVal) {
                        row[colIdx] = writeVal;
                        sheetUpdated = true;
                     }
                     // Update memory
                     marksToUpsert.push({
                        id: existingMark.id,
                        enrollment_id: enrollment.id,
                        assessment_id: assessment.id,
                        score: tamsScore,
                        sheet_synced_score: tamsScore,
                        updated_by: user.id
                     });
                     existingMark.sheet_synced_score = tamsScore; // update local ref
                  } else if (sheetScore !== syncedScore) {
                     // 2. Sheet was modified externally! Pull to TAMS.
                     if (sheetScore === null) {
                        // Safe Mode: If sheet is blank but TAMS has a grade, 
                        // push TAMS grade back to sheet instead of deleting from DB.
                        while (row.length <= colIdx) row.push("");
                        const writeVal = tamsScore !== null ? String(tamsScore) : "";
                        if (row[colIdx] !== writeVal) {
                           row[colIdx] = writeVal;
                           sheetUpdated = true;
                        }
                     } else {
                        marksToUpsert.push({
                           id: existingMark.id,
                           enrollment_id: enrollment.id,
                           assessment_id: assessment.id,
                           score: sheetScore,
                           sheet_synced_score: sheetScore,
                           updated_by: user.id
                        });
                        existingMark.score = sheetScore;
                        existingMark.sheet_synced_score = sheetScore;
                     }
                  }
                } else {
                  // 3. No mark in TAMS yet. Check if sheet has a grade.
                  if (sheetScore !== null) {
                     marksToUpsert.push({
                        enrollment_id: enrollment.id,
                        assessment_id: assessment.id,
                        score: sheetScore,
                        sheet_synced_score: sheetScore,
                        updated_by: user.id
                     });
                     // Create local ref to prevent duplicates if processed again
                     if (enrollment.marks) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (enrollment.marks as any[]).push({
                           id: "temp",
                           assessment_id: assessment.id,
                           score: sheetScore,
                           sheet_synced_score: sheetScore
                        });
                     }
                  } else {
                     // Neither has a grade, but if we need to write empty cell to sheet?
                     // Usually handled by default. We do nothing.
                  }
                }
              }
            }
          }

          if (sheetUpdated) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: tabName,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: tabRows },
            });
            gradesWritten = true;
          }
        }

        // Apply bulk upserts to TAMS database
        if (marksToUpsert.length > 0) {
          const dedupedMarks = Array.from(
            new Map(marksToUpsert.map((m) => [`${m.enrollment_id}:${m.assessment_id}`, m])).values()
          );

          const { error: upsertError } = await admin
            .from("marks")
            .upsert(dedupedMarks, { onConflict: "enrollment_id, assessment_id" });
          
          if (upsertError) {
             console.error("Failed to sync grades to TAMS DB:", upsertError);
             return NextResponse.json(
               { error: "Students were synced but grades could not be saved. Nothing was written to TAMS." },
               { status: 500 }
             );
          } else {
             gradesWritten = true; // Signals that grades were processed
          }
        }

        // (No delete branch: "Safe Mode" deliberately never removes a mark
        // from TAMS just because the sheet cell went blank -- a cleared or
        // malformed sheet must not destroy grade data.)
      }
    }

    const response: SyncResponse = {
      invited: results.filter(r => r.outcome === "invited"),
      existing: results.filter(r => r.outcome === "existing"),
      failed: results.filter(r => r.outcome === "failed"),
      rejectedScores,
      skippedAssessments,
      gradesWritten,
      totalProcessed: results.length,
      missingFromSheet,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Google Sync error:", err);
    let errorMessage = "An unexpected error occurred";
    if (err instanceof Error) errorMessage = err.message;
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
