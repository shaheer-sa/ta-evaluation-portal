import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Types for the structured sync result ────────────────────────────

interface SyncStudentResult {
  email: string;
  rollNumber: string;
  fullName: string;
  outcome: "invited" | "existing" | "enrolled" | "failed";
  detail?: string;
}

interface SyncResponse {
  invited: SyncStudentResult[];
  existing: SyncStudentResult[];
  failed: SyncStudentResult[];
  gradesWritten: boolean;
  totalProcessed: number;
}

// ── Concurrency-limited batch runner ────────────────────────────────

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ── Main handler ────────────────────────────────────────────────────

export async function POST(request: Request) {
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

    // 1. Fetch data from Google Sheets
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1",
    });

    const rows = sheetData.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Spreadsheet is empty" }, { status: 400 });
    }

    const headers = rows[0].map((h: string) => h.toLowerCase().trim().replace(/ /g, "_"));
    const rollNumIdx = headers.indexOf("roll_number");
    const nameIdx = headers.indexOf("full_name");
    const emailIdx = headers.indexOf("email");

    if (rollNumIdx === -1 || nameIdx === -1 || emailIdx === -1) {
      return NextResponse.json(
        { error: "Spreadsheet must contain headers: roll_number, full_name, email" },
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

    // Get assessments to map column names to assessment IDs
    const { data: assessments } = await supabase
      .from("assessments")
      .select("id, title")
      .eq("section_course_id", sectionCourseId);

    const admin = createAdminClient();

    // 2. Parse student rows (skip header)
    const studentRows = rows.slice(1).filter(row => row[emailIdx]);
    const parsedStudents = studentRows.map(row => ({
      email: row[emailIdx]?.trim(),
      roll_number: row[rollNumIdx]?.trim() || "",
      full_name: row[nameIdx]?.trim() || "",
    }));

    // 3. Invite/enroll students in batches of 5
    const BATCH_SIZE = 5;

    const results = await runInBatches(parsedStudents, BATCH_SIZE, async (student): Promise<SyncStudentResult> => {
      try {
        let studentId = "";

        // Try to invite
        const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(
          student.email,
          {
            data: {
              roll_number: student.roll_number,
              full_name: student.full_name,
            },
            redirectTo: process.env.NEXT_PUBLIC_APP_URL
              ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
              : undefined,
          }
        );

        if (authError) {
          // User probably already exists — look them up
          const { data: existingProfile } = await admin
            .from("profiles")
            .select("id")
            .eq("email", student.email)
            .single();

          if (existingProfile) {
            studentId = existingProfile.id;
          } else {
            // Genuinely failed — couldn't invite and can't find them
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
        }

        // Enroll (ignore unique-constraint violations — means already enrolled)
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

        // Distinguish: were they freshly invited, or did they already exist?
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

    // 4. Push TAMS marks back to Google Sheets (TAMS is source of truth for grades)
    let gradesWritten = false;

    if (assessments && assessments.length > 0) {
      const { data: currentEnrollments } = await admin
        .from("enrollments")
        .select(`
          id,
          profiles:student_id ( email ),
          marks ( assessment_id, score )
        `)
        .eq("section_id", mapped.section_id)
        .eq("course_id", mapped.course_id);

      if (currentEnrollments) {
        let sheetUpdated = false;

        for (const assessment of assessments) {
          let colIdx = headers.indexOf(assessment.title.toLowerCase().trim().replace(/ /g, "_"));

          // If the column doesn't exist, append it to the header
          if (colIdx === -1) {
            colIdx = headers.length;
            headers.push(assessment.title);
            rows[0][colIdx] = assessment.title;
            sheetUpdated = true;
          }

          // Fill in marks for each student
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const email = row[emailIdx];
            if (!email) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const enrollment = currentEnrollments.find(e => (e.profiles as any)?.email === email);
            if (enrollment) {
              const mark = enrollment.marks.find(m => m.assessment_id === assessment.id);
              if (mark) {
                if (row[colIdx] !== String(mark.score)) {
                  row[colIdx] = String(mark.score);
                  sheetUpdated = true;
                }
              }
            }
          }
        }

        // Push updated 2D array back to Google Sheets
        if (sheetUpdated) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: "Sheet1",
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: rows,
            },
          });
          gradesWritten = true;
        }
      }
    }

    // 5. Build structured response
    const response: SyncResponse = {
      invited: results.filter(r => r.outcome === "invited"),
      existing: results.filter(r => r.outcome === "existing"),
      failed: results.filter(r => r.outcome === "failed"),
      gradesWritten,
      totalProcessed: results.length,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("Google Sync error:", err);
    let errorMessage = "An unexpected error occurred";
    if (err instanceof Error) errorMessage = err.message;
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
