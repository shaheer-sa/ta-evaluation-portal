import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const { sectionCourseId, students } = await request.json();

    if (!sectionCourseId || !students || !Array.isArray(students)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Get section_id and course_id
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

    for (const student of students) {
      let studentId = "";
      
      // Create the user silently with a default password.
      // They are forced to change this password on their first login.
      const defaultPassword = `Tams@${student.roll_number.replace(/\s/g, "")}`;
      
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: student.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          roll_number: student.roll_number,
          full_name: student.full_name,
        }
      });

      if (authError) {
        // If email already exists, just get their ID from profiles
        const { data: existingProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("email", student.email)
          .single();
          
        if (existingProfile) {
          studentId = existingProfile.id;
        } else {
          console.error("Failed to create/find user:", student.email, authError);
          continue;
        }
      } else {
        studentId = authData.user.id;
        // Wait a tiny bit for the database trigger to insert the profile
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Enroll them
      if (studentId) {
        let enrollmentId = "";
        const { data: newEnrollment, error: enrollError } = await admin.from("enrollments").insert({
          student_id: studentId,
          section_id: mapped.section_id,
          course_id: mapped.course_id,
        }).select("id").single();
        
        // 23505 is unique violation (already enrolled)
        if (enrollError && enrollError.code !== "23505") {
          console.error(`Failed to enroll ${student.email}:`, enrollError);
        } else if (newEnrollment) {
          enrollmentId = newEnrollment.id;
        } else {
          // If already enrolled, get the existing enrollment ID for marks sync
          const { data: existingEnrollment } = await admin
            .from("enrollments")
            .select("id")
            .eq("student_id", studentId)
            .eq("section_id", mapped.section_id)
            .eq("course_id", mapped.course_id)
            .single();
          if (existingEnrollment) enrollmentId = existingEnrollment.id;
        }

        // Sync Marks if enrollmentId exists and we have assessments
        if (enrollmentId && assessments && assessments.length > 0) {
          for (const assessment of assessments) {
            // If the excel sheet has a column matching the assessment title
            if (student[assessment.title] !== undefined && student[assessment.title] !== "") {
              const score = parseFloat(student[assessment.title]);
              if (!isNaN(score)) {
                // Upsert mark (requires a unique constraint on enrollment_id + assessment_id)
                // If there's no unique constraint, this might duplicate, but we assume there is one or we just do an upsert
                // A safer way is to check if it exists, then update, or insert.
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
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
