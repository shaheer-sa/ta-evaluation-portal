export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { sendQueryEmail } from "@/lib/email/gmail";
import { formatStatus } from "@/lib/format";

import { createRateLimiter } from "@/lib/rate-limit";

const studentQueryRateLimit = createRateLimiter({ tokens: 5, window: "10 m" });

const createQuerySchema = z.object({
  enrollmentId: z.string().uuid("Invalid enrollment ID."),
  assessmentId: z.string().uuid("Invalid assessment ID.").nullable().optional(),
  title: z.string().trim().min(1, "Title is required.").max(150, "Title must be 150 characters or fewer."),
  description: z.string().trim().min(1, "Description is required.").max(3000, "Description must be 3000 characters or fewer."),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

const updateQueryStatusSchema = z.object({
  action: z.literal("updateStatus"),
  queryId: z.string().uuid("Invalid query ID."),
  newStatus: z.enum(["pending", "in_review", "resolved", "rejected"]),
});

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
        assessments:assessment_id ( title ),
        enrollments ( sections ( name ) )
    `;

    if (profile?.role === "ta") {
      selectStr = selectStr.replace(
        "enrollments ( sections ( name ) )",
        "enrollments!inner ( section_id, sections ( name ) )"
      );
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
      const parsed = updateQueryStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Invalid query or status." },
          { status: 400 }
        );
      }
      const { queryId, newStatus } = parsed.data;

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
        // Create notification for the student
        try {
          await supabase.from("notifications").insert({
            recipient_id: queryData.student_id,
            type: "query_update",
            title: `Query "${queryData.title}" → ${formatStatus(newStatus)}`,
            body: `Your query has been marked as ${formatStatus(newStatus)} by the TA.`,
            related_id: queryId,
          });
        } catch (notifErr) {
          console.error("Failed to insert notification:", notifErr);
        }

        // Send email via Gmail SMTP without blocking
        const studentEmail = queryData.profiles?.email;
        if (studentEmail) {
          after(async () => {
            await Promise.allSettled([
              sendQueryEmail({
                to: studentEmail,
                studentName: queryData.profiles?.full_name || "Student",
                queryTitle: queryData.title,
                kind: "status_change",
                message: `Status changed to ${formatStatus(newStatus)}`,
                queryId,
                recipientRole: "student",
              }).catch((err) => console.error("SMTP error (status change):", err)),
            ]);
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    // Student creating query
    if (profile?.role === "student") {
      if (studentQueryRateLimit) {
        const { success, reset } = await studentQueryRateLimit.limit(`query-create:${user.id}`);
        if (!success) {
          const retryAfter = Math.ceil((reset - Date.now()) / 1000);
          return NextResponse.json(
            { error: "You're doing that too often. Please wait a few minutes and try again." },
            {
              status: 429,
              headers: { "Retry-After": retryAfter.toString() },
            }
          );
        }
      }

      const parsed = createQuerySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Please provide valid query details." },
          { status: 400 }
        );
      }
      const { enrollmentId, assessmentId, title, description, priority } = parsed.data;

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

      const { data, error } = await supabase.from("queries").insert({
        student_id: user.id,
        enrollment_id: enrollmentId,
        assessment_id: assessmentId || null,
        title,
        description,
        priority: priority || "medium",
        status: "pending",
      }).select("id").single();

      if (error) throw error;

      // Notify the TA — find TA users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tas } = await (supabase as any).rpc("get_ta_contacts");

      if (tas && tas.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const notifications = tas.map((ta: any) => ({
          recipient_id: ta.id,
          type: "new_query",
          title: `New query: "${title}"`,
          body: `A student raised a ${priority || "medium"} priority query.`,
          related_id: data.id,
        }));
        await supabase.from("notifications").insert(notifications);

        // Send emails
        after(async () => {
          const emailPromises = tas
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((ta: any) => ta.email)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((ta: any) =>
              sendQueryEmail({
                to: ta.email,
                studentName: "TA",
                queryTitle: title,
                kind: "new_query",
                message: `Priority: ${priority || "medium"}\n\n${description}`,
                queryId: data.id,
                recipientRole: "ta",
              }).catch((err) =>
                console.error(`Failed to send new query email to ${ta.email}:`, err)
              )
            );
          await Promise.allSettled(emailPromises);
        });
      } else {
        console.warn("No TAs found to notify for new query");
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

/**
 * DELETE /api/queries?id=<queryId>
 * TA can delete a query.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "ta") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const parsed = z.string().uuid("A valid query ID is required.").safeParse(id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "A valid query ID is required." },
        { status: 400 }
      );
    }
    const queryId = parsed.data;

    // delete notifications where related_id = id
    try {
      const admin = createAdminClient();
      await admin.from("notifications").delete().eq("related_id", queryId);
    } catch (notifErr) {
      console.error("Failed to delete notifications with admin client:", notifErr);
      await supabase.from("notifications").delete().eq("related_id", queryId);
    }

    // then delete the query (replies are removed automatically)
    const { error: queryDeleteError } = await supabase
      .from("queries")
      .delete()
      .eq("id", queryId);

    if (queryDeleteError) {
      console.error("Query delete error:", queryDeleteError);
      return NextResponse.json(
        { error: "Couldn't delete the query. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Query delete error:", err);
    return NextResponse.json(
      { error: "Couldn't delete the query. Please try again." },
      { status: 500 }
    );
  }
}
