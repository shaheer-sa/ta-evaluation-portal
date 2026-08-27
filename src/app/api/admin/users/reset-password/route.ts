import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTA } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";

const resetPasswordRateLimit = createRateLimiter({ tokens: 10, window: "1 h" });

const schema = z.object({ studentId: z.string().uuid() });

export async function POST(request: NextRequest) {
  let taUserId: string;
  try {
    const authInfo = await requireTA();
    taUserId = authInfo.userId;
  } catch (err: unknown) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (resetPasswordRateLimit) {
    const { success, reset } = await resetPasswordRateLimit.limit(`reset-password:${taUserId}`);
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

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: student } = await admin
    .from("profiles")
    .select("id, roll_number, role")
    .eq("id", parsed.data.studentId)
    .single();

  if (!student || student.role !== "student" || !student.roll_number) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(student.id, {
    password: `Tams@${student.roll_number}`,
  });
  if (pwError) {
    console.error("Password reset failed:", pwError);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }

  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", student.id);

  return NextResponse.json({ success: true, rollNumber: student.roll_number });
}
