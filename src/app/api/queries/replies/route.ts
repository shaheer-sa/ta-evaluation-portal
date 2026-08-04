import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A query thread is readable and writable by exactly two parties: the
 * student who raised it, and any TA. Everyone else gets a 403.
 */
async function canAccessQuery(
  supabase: SupabaseClient,
  userId: string,
  queryId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "ta") return true;

  const { data: own } = await supabase
    .from("queries")
    .select("id")
    .eq("id", queryId)
    .eq("student_id", userId)
    .maybeSingle();

  return Boolean(own);
}

/**
 * GET /api/queries/replies?queryId=xxx
 * Fetch all replies for a specific query. Both TAs and the query's
 * student can read replies (RLS handles this at the database level).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const queryId = url.searchParams.get("queryId");

    if (!queryId) {
      return NextResponse.json({ error: "queryId is required" }, { status: 400 });
    }

    // Confirm the caller is actually party to this thread before returning
    // its contents. Previously any authenticated user could enumerate query
    // IDs and read every conversation in the system; the route relied
    // entirely on RLS policies that are not part of the repository.
    const authorized = await canAccessQuery(supabase, user.id, queryId);
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: replies, error } = await supabase
      .from("replies")
      .select(`
        id,
        query_id,
        sender_id,
        message,
        created_at,
        profiles:sender_id ( full_name, role )
      `)
      .eq("query_id", queryId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ replies: replies || [] });
  } catch (err: unknown) {
    console.error("Replies fetch error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queries/replies
 * Create a reply on a query. Both TAs and the query's student can post.
 * Body: { queryId, message }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { queryId, message } = await request.json();

    if (!queryId || !message?.trim()) {
      return NextResponse.json(
        { error: "queryId and message are required" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    // Same ownership check as the GET branch -- a student must not be able
    // to post into another student's dispute thread.
    const authorized = await canAccessQuery(supabase, user.id, queryId);
    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from("replies").insert({
      query_id: queryId,
      sender_id: user.id,
      message: message.trim(),
    });

    if (error) throw error;

    // Notify the other party
    const { data: queryData } = await supabase
      .from("queries")
      .select("student_id, title")
      .eq("id", queryId)
      .single();

    if (queryData) {
      if (profile?.role === "ta") {
        // TA replied → notify the student
        await supabase.from("notifications").insert({
          recipient_id: queryData.student_id,
          type: "query_reply",
          title: `New reply on "${queryData.title}"`,
          body: `The TA replied to your query.`,
          related_id: queryId,
        });
      } else {
        // Student replied → notify all TAs
        const { data: tas } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "ta");

        if (tas && tas.length > 0) {
          await supabase.from("notifications").insert(
            tas.map((ta) => ({
              recipient_id: ta.id,
              type: "query_reply",
              title: `Reply on "${queryData.title}"`,
              body: `${profile?.full_name || "A student"} replied to their query.`,
              related_id: queryId,
            }))
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Reply create error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
