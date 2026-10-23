export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { escapeLikePattern } from "@/lib/identifiers";
import { sendResetRequestEmail } from "@/lib/email/gmail";

const schema = z.object({
  identifier: z.string().min(1, "Enter your email or roll number"),
});

const forgotPasswordRateLimit = createRateLimiter({ tokens: 3, window: "1 h" });
const globalRateLimit = createRateLimiter({ tokens: 30, window: "1 h" });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { identifier } = parsed.data;

    if (globalRateLimit) {
      const { success, reset } = await globalRateLimit.limit("forgot-password:global");
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: "Too many attempts, please try again later" },
          { 
            status: 429,
            headers: { "Retry-After": retryAfter.toString() }
          }
        );
      }
    }

    if (forgotPasswordRateLimit) {
      const ip = getClientIp(request);
      const { success, reset } = await forgotPasswordRateLimit.limit(`forgot-password:${ip}`);
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json(
          { error: "Too many attempts, please try again later" },
          { 
            status: 429,
            headers: { "Retry-After": retryAfter.toString() }
          }
        );
      }
    }

    const admin = createAdminClient();
    let query = admin
      .from("profiles")
      .select("id, full_name, roll_number, email, role");

    if (identifier.includes("@")) {
      query = query.ilike("email", escapeLikePattern(identifier.trim()));
    } else {
      query = query.ilike("roll_number", escapeLikePattern(identifier.trim()));
    }

    const { data: profile } = await query.maybeSingle();

    if (profile && profile.role === "student") {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingNotification } = await admin
        .from("notifications")
        .select("id")
        .eq("type", "password_reset_request")
        .eq("related_id", profile.id)
        .eq("is_read", false)
        .gte("created_at", twentyFourHoursAgo)
        .limit(1)
        .maybeSingle();

      if (!existingNotification) {
        const { data: enrollments } = await admin
          .from("enrollments")
          .select(`
            id,
            status,
            sections ( name, terms ( is_active ) )
          `)
          .eq("student_id", profile.id)
          .eq("status", "active");

        type EnrollmentWithSection = {
          sections: {
            name: string;
            terms: { is_active: boolean } | null;
          } | null;
        };

        const activeEnrollments = (enrollments as unknown as EnrollmentWithSection[]) || [];
        const preferred = activeEnrollments.find(e => e.sections?.terms?.is_active) || activeEnrollments[0];
        const sectionName = preferred?.sections?.name || null;

        const { data: tas } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .eq("role", "ta");

        if (tas && tas.length > 0) {
          const notifs = tas.map(ta => ({
            recipient_id: ta.id,
            type: "password_reset_request",
            title: `Password reset request: ${profile.full_name} (${profile.roll_number})`,
            body: `Section ${sectionName || "unknown"}. Click to open and reset their password.`,
            related_id: profile.id,
          }));
          await admin.from("notifications").insert(notifs);

          after(async () => {
            const emailPromises = tas
              .filter(ta => ta.email)
              .map(ta =>
                sendResetRequestEmail({
                  to: ta.email,
                  taName: ta.full_name || "TA",
                  studentName: profile.full_name || "Student",
                  rollNumber: profile.roll_number || "",
                  sectionName,
                  studentId: profile.id,
                }).catch(err => console.error(`Failed to send reset request email to ${ta.email}:`, err))
              );
            await Promise.allSettled(emailPromises);
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
