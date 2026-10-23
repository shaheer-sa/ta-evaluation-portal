export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendQueryEmail } from "@/lib/email/gmail";
import { createRateLimiter } from "@/lib/rate-limit";

const replyRateLimit = createRateLimiter({ tokens: 20, window: "10 m" });

const postReplySchema = z.object({
  queryId: z.string().uuid("Invalid query ID."),
  message: z.string().trim().min(1, "Message cannot be empty.").max(3000, "Message must be 3000 characters or fewer."),
});

/**
 * A query thread is readable and writable by exactly two parties: the
 * student who raised it, and any TA. Everyone else gets a 403.
 */
async function canAccessQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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
    const rawQueryId = url.searchParams.get("queryId");
    const queryIdParsed = z.string().uuid("Invalid query ID.").safeParse(rawQueryId);

    if (!queryIdParsed.success) {
      return NextResponse.json({ error: "A valid query ID is required." }, { status: 400 });
    }
    const queryId = queryIdParsed.data;

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

    const senderIds = [...new Set((replies || []).map((r) => r.sender_id))];
    let senders: { id: string; full_name: string; role: string }[] = [];
    if (senderIds.length > 0) {
      const { data: readable } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", senderIds);
        
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: tas } = await (supabase as any).rpc("get_tas");
      
      senders = [...(readable || []), ...(tas || [])];
    }

    const senderMap = new Map(senders.map((s) => [s.id, s]));
    const enriched = (replies || []).map((r) => {
      const sender = senderMap.get(r.sender_id);
      return {
        ...r,
        profiles: sender
          ? {
              full_name: sender.full_name,
              role: sender.role,
            }
          : null,
      };
    });

    return NextResponse.json({ replies: enriched });
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

    if (replyRateLimit) {
      const { success, reset } = await replyRateLimit.limit(`reply:${user.id}`);
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

    const body = await request.json();
    const parsed = postReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid reply payload." },
        { status: 400 }
      );
    }

    const { queryId, message } = parsed.data;

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
      .select("student_id, title, profiles:student_id ( email, full_name )")
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const studentProfile = queryData.profiles as any;
        if (studentProfile?.email) {
          after(async () => {
            await Promise.allSettled([
              sendQueryEmail({
                to: studentProfile.email,
                studentName: studentProfile.full_name || "Student",
                queryTitle: queryData.title,
                kind: "reply",
                message: message,
                queryId,
                recipientRole: "student",
              }).catch((err) => console.error("SMTP error (reply):", err)),
            ]);
          });
        }
      } else {
        // Student replied → notify all TAs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tas } = await (supabase as any).rpc("get_tas");

        if (tas && tas.length > 0) {
          const { error: notifyError } = await supabase.from("notifications").insert(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tas.map((ta: any) => ({
              recipient_id: ta.id,
              type: "query_reply",
              title: `Reply on "${queryData.title}"`,
              body: `${profile?.full_name || "A student"} replied to their query.`,
              related_id: queryId,
            }))
          );
          if (notifyError) console.error("TA notify failed:", notifyError);

          // Get emails for all TAs using the SECURITY DEFINER RPC
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: taProfiles } = await (supabase as any).rpc("get_ta_contacts");

          if (taProfiles && taProfiles.length > 0) {
            after(async () => {
              const emailPromises = taProfiles
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((taProfile: any) => taProfile.email)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((taProfile: any) =>
                  sendQueryEmail({
                    to: taProfile.email,
                    studentName: taProfile.full_name || "TA",
                    queryTitle: queryData.title,
                    kind: "student_reply",
                    message: message,
                    queryId,
                    recipientRole: "ta",
                    senderName: profile?.full_name || "A student",
                  }).catch((err) => console.error("SMTP error (student reply):", err))
                );
              await Promise.allSettled(emailPromises);
            });
          } else {
            console.warn("No TAs found to notify for student reply");
          }
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
