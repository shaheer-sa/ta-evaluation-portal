import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";
import { runInBatches } from "@/lib/batch";
import { z } from "zod";

export const maxDuration = 60;

const importRateLimit = createRateLimiter({ tokens: 2, window: "10 m" });

function generateInitialPassword(rollNumber: string): string {
  return `Tams@${rollNumber}`;
}

const importSchema = z.object({
  sectionCourseId: z.string().uuid(),
  students: z.array(z.record(z.any())).max(500),
});

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

    if (importRateLimit) {
      const { success, reset } = await importRateLimit.limit(`import:${user.id}`);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: "Too many import attempts, please wait before trying again." },
          { 
            status: 429,
            headers: { "Retry-After": retryAfter.toString() }
          }
        );
      }
    }

    const body = await request.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.errors }, { status: 400 });
    }

    const { sectionCourseId, students } = parsed.data;

    // Get section_id and course_id
    const { data: mapped } = await supabase
      .from("section_courses")
      .select("section_id, course_id")
      .eq("id", sectionCourseId)
      .single();

    if (!mapped) {
      return NextResponse.json({ error: "Mapped section not found" }, { status: 404 });
    }

    // Get assessments to map column names to assessment IDs and validate max_marks
    const { data: assessments } = await supabase
      .from("assessments")
      .select("id, title, max_marks")
      .eq("section_course_id", sectionCourseId);

    const admin = createAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invited: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const failed: any[] = [];
    let totalProcessed = 0;

    await runInBatches(students, 5, async (student) => {
      totalProcessed++;
      const result = {
        email: student.email,
        rollNumber: student.roll_number,
        fullName: student.full_name,
      };

      try {
        if (!student.email || !student.roll_number) {
          throw new Error("Missing email or roll number");
        }

        let studentId = "";
        let isNew = false;
        
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
          const { data: existingProfile } = await admin
            .from("profiles")
            .select("id")
            .eq("email", student.email)
            .single();
            
          if (existingProfile) {
            studentId = existingProfile.id;
          } else {
            throw new Error(`Failed to create/find user: ${authError.message}`);
          }
        } else {
          studentId = authData.user.id;
          isNew = true;
          
          await admin
            .from("profiles")
            .update({ must_change_password: true })
            .eq("id", authData.user.id);

          // Retry loop for polling the profile row (3 attempts, 150ms apart)
          let profileFound = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { data: check } = await admin.from("profiles").select("id").eq("id", studentId).single();
            if (check) {
              profileFound = true;
              break;
            }
            await new Promise(r => setTimeout(r, 150));
          }
          if (!profileFound) {
            throw new Error("Profile trigger failed or timed out");
          }
        }

        if (studentId) {
          let enrollmentId = "";
          const { data: newEnrollment, error: enrollError } = await admin.from("enrollments").insert({
            student_id: studentId,
            section_id: mapped.section_id,
            course_id: mapped.course_id,
          }).select("id").single();
          
          if (enrollError && enrollError.code !== "23505") {
            throw new Error(`Enrollment failed: ${enrollError.message}`);
          } else if (newEnrollment) {
            enrollmentId = newEnrollment.id;
          } else {
            const { data: existingEnrollment } = await admin
              .from("enrollments")
              .select("id")
              .eq("student_id", studentId)
              .eq("section_id", mapped.section_id)
              .eq("course_id", mapped.course_id)
              .single();
            if (existingEnrollment) enrollmentId = existingEnrollment.id;
          }

          if (enrollmentId && assessments && assessments.length > 0) {
            for (const assessment of assessments) {
              const rawScore = student[assessment.title];
              if (rawScore === undefined || rawScore === null || rawScore === "") continue;

              const score = Number(rawScore);
              const maxMarks = Number(assessment.max_marks);

              if (!Number.isFinite(score)) throw new Error(`Score for ${assessment.title} is not a number`);
              if (score < 0) throw new Error(`Score for ${assessment.title} is negative`);
              if (maxMarks > 0 && score > maxMarks) {
                throw new Error(`Score for ${assessment.title} is above the maximum of ${maxMarks}`);
              }

              const { data: existingMark } = await admin
                .from("marks")
                .select("id")
                .eq("enrollment_id", enrollmentId)
                .eq("assessment_id", assessment.id)
                .single();
                
              if (existingMark) {
                await admin.from("marks").update({ score, updated_by: user.id }).eq("id", existingMark.id);
              } else {
                await admin.from("marks").insert({
                  enrollment_id: enrollmentId,
                  assessment_id: assessment.id,
                  score,
                  updated_by: user.id,
                });
              }
            }
          }
        }

        if (isNew) {
          invited.push({ ...result, outcome: "invited" });
        } else {
          existing.push({ ...result, outcome: "existing" });
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        failed.push({ ...result, outcome: "failed", detail: err.message });
      }
    });

    return NextResponse.json({ 
      invited,
      existing,
      failed,
      totalProcessed,
      success: true 
    });
  } catch (err: unknown) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
