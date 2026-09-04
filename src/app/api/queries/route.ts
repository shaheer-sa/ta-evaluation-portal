import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  sendEmailNotification,
  escapeHtml,
  escapeHtmlMultiline,
} from "@/lib/email";

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

    let selectStr = `
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
    `;

    if (profile?.role === "ta") {
      selectStr += `, enrollments!inner ( section_id )`;
    }

    let query = supabase
      .from("queries")
      .select(selectStr)
      .order("created_at", { ascending: false });

    // Students only see their own queries
    if (profile?.role === "student") {
      query = query.eq("student_id", user.id);
    } else if (profile?.role === "ta") {
      // Scope the TA's list to the active term, matching the behaviour the
      // TA dashboard already implements and the README documents. Without
      // this the queries page showed every query ever raised, so last
      // semester's resolved disputes stayed mixed in with this one's.
      const { data: activeTerm } = await supabase
        .from("terms")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

      if (activeTerm) {
        const { data: activeSections } = await supabase
          .from("sections")
          .select("id")
          .eq("term_id", activeTerm.id);

        const sectionIds = (activeSections || []).map((s) => s.id);

        if (sectionIds.length > 0) {
          query = query.in("enrollments.section_id", sectionIds);
        } else {
          // An empty term legitimately has no queries; an impossible filter
          // returns the empty list rather than silently falling back to all.
          query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
        }
      }
      // No active term at all -> leave unscoped so the TA can still triage.
    }

    if (status && status !== "all") {
      query = query.eq(
        "status",
        status as Database["public"]["Tables"]["queries"]["Row"]["status"]
      );
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

      // Guard the enum: an arbitrary string here would be written straight
      // into the status column and then rendered in both dashboards.
      const VALID_STATUSES = ["pending", "in_review", "resolved", "rejected"];
      if (!queryId || !VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json(
          { error: "Invalid query or status" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("queries")
        .update({ status: newStatus })
        .eq("id", queryId);

      if (error) throw error;

      // Create notification for the student
      const { data: rawQueryData } = await supabase
        .from("queries")
        .select(`
          student_id, 
          title,
          profiles:student_id ( email, full_name )
        `)
        .eq("id", queryId)
        .single();
        
      type QueryData = Pick<import("@/types/database").Database["public"]["Tables"]["queries"]["Row"], "student_id" | "title"> & {
        profiles: Pick<import("@/types/database").Database["public"]["Tables"]["profiles"]["Row"], "email" | "full_name"> | null;
      };
      
      const queryData = rawQueryData as unknown as QueryData | null;

      if (queryData) {
        await supabase.from("notifications").insert({
          recipient_id: queryData.student_id,
          type: "query_update",
          title: `Query "${queryData.title}" → ${newStatus}`,
          body: `Your query has been marked as ${newStatus} by the TA.`,
          related_id: queryId,
        });

        // Send email
        const studentEmail = queryData.profiles?.email;
        if (studentEmail) {
          const result = await sendEmailNotification(
            studentEmail,
            `Query Status Update: ${queryData.title}`,
            `<p>Your query <strong>"${escapeHtml(queryData.title)}"</strong> has been marked as <strong>${escapeHtml(newStatus.replace("_", " "))}</strong> by the TA.</p>
             <p>Log in to TAMS to view details or reply.</p>`
          );
          if (!result.delivered) {
            console.warn(`Failed to send status update email to ${studentEmail}: ${result.reason}`);
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    // Student creating query
    if (profile?.role === "student") {
      const { enrollmentId, assessmentId, title, description, priority } = body;

      if (!enrollmentId || !title?.trim() || !description?.trim()) {
        return NextResponse.json(
          { error: "Course, title and description are required" },
          { status: 400 }
        );
      }

      if (priority && !["low", "medium", "high"].includes(priority)) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }

      // Confirm the enrollment belongs to the student filing the query.
      // Without this the enrollment ID is simply whatever the browser sent,
      // so a student could file a dispute against a classmate's enrollment
      // and pull that classmate into their notification thread.
      const { data: ownEnrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("id", enrollmentId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (!ownEnrollment) {
        return NextResponse.json(
          { error: "You are not enrolled in that course" },
          { status: 403 }
        );
      }

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
          body: `A student raised a ${priority || "medium"} priority query.`,
        }));
        await supabase.from("notifications").insert(notifications);

        // Send emails
        // Use Promise.all to send them in parallel
        await Promise.all(tas.map(async (ta) => {
          if (ta.email) {
            const result = await sendEmailNotification(
              ta.email,
              `New Student Query: ${title}`,
              `<p>A new ${escapeHtml(priority || "medium")}-priority query was raised:</p>
               <p><strong>Title:</strong> ${escapeHtml(title)}</p>
               <p><strong>Description:</strong><br/>${escapeHtmlMultiline(description)}</p>
               <p>Log in to TAMS to review it.</p>`
            );
            if (!result.delivered) {
              console.warn(`Failed to send new query email to ${ta.email}: ${result.reason}`);
            }
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
