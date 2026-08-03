import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmailNotification } from "@/lib/email";

/**
 * GET /api/queries
 * Fetch queries. TA sees all, student sees only their own.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    let query = supabase
      .from("queries")
      .select(`
        id,
        student_id,
        enrollment_id,
        assessment_id,
        title,
        description,
        priority,
        status,
        created_at,
        updated_at,
        profiles:student_id ( full_name, roll_number ),
        assessments:assessment_id ( title )
      `)
      .order("created_at", { ascending: false });

    // Students only see their own queries
    if (profile?.role === "student") {
      query = query.eq("student_id", user.id);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ queries: data || [] });
  } catch (err: unknown) {
    console.error("Queries fetch error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queries
 * Create a new query (student) or update status (TA).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const body = await request.json();

    // TA updating status
    if (body.action === "updateStatus" && profile?.role === "ta") {
      const { queryId, newStatus } = body;
      const { error } = await supabase
        .from("queries")
        .update({ status: newStatus })
        .eq("id", queryId);

      if (error) throw error;

      // Create notification for the student
      const { data: queryData } = await supabase
        .from("queries")
        .select(`
          student_id, 
          title,
          profiles:student_id ( email, full_name )
        `)
        .eq("id", queryId)
        .single();

      if (queryData) {
        await supabase.from("notifications").insert({
          recipient_id: queryData.student_id,
          type: "query_update",
          title: `Query "${queryData.title}" → ${newStatus}`,
          body: `Your query has been marked as ${newStatus} by the TA.`,
          related_id: queryId,
        });

        // Send email
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const studentEmail = (queryData.profiles as any)?.email;
        if (studentEmail) {
          await sendEmailNotification(
            studentEmail,
            `Query Status Update: ${queryData.title}`,
            `<p>Your query <strong>"${queryData.title}"</strong> has been marked as <strong>${newStatus.replace("_", " ")}</strong> by the TA.</p>
             <p>Log in to TAMS to view details or reply.</p>`
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    // Student creating query
    if (profile?.role === "student") {
      const { enrollmentId, assessmentId, title, description, priority } = body;

      const { error } = await supabase.from("queries").insert({
        student_id: user.id,
        enrollment_id: enrollmentId,
        assessment_id: assessmentId || null,
        title,
        description,
        priority: priority || "medium",
        status: "pending",
      });

      if (error) throw error;

      // Notify the TA — find TA users
      const { data: tas } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("role", "ta");

      if (tas) {
        const notifications = tas.map((ta) => ({
          recipient_id: ta.id,
          type: "new_query",
          title: `New query: "${title}"`,
          body: `${profile ? "A student" : "Someone"} raised a ${priority || "medium"} priority query.`,
        }));
        await supabase.from("notifications").insert(notifications);

        // Send emails
        // Use Promise.all to send them in parallel
        await Promise.all(tas.map(ta => {
          if (ta.email) {
            return sendEmailNotification(
              ta.email,
              `New Student Query: ${title}`,
              `<p>A new ${priority || "medium"}-priority query was raised:</p>
               <p><strong>Title:</strong> ${title}</p>
               <p><strong>Description:</strong><br/>${description.replace(/\n/g, '<br/>')}</p>
               <p>Log in to TAMS to review it.</p>`
            );
          }
        }));
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Queries error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
