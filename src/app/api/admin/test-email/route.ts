export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireTA } from "@/lib/auth-guard";
import { createRateLimiter } from "@/lib/rate-limit";
import { sendTestEmail } from "@/lib/email/gmail";

const testEmailRateLimit = createRateLimiter({ tokens: 5, window: "10 m" });

// ta only: sends a test email to the ta's own address and returns gmail's answer
export async function POST() {
  let userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any;
  try {
    ({ supabase, userId } = await requireTA());
  } catch {
    return NextResponse.json({ error: "Only teaching assistants can do this." }, { status: 403 });
  }

  if (testEmailRateLimit) {
    const { success } = await testEmailRateLimit.limit(`test-email:${userId}`);
    if (!success) {
      return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
    }
  }

  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  const to = profile?.email as string | undefined;
  if (!to) {
    return NextResponse.json({ error: "Your profile has no email address." }, { status: 400 });
  }

  const result = await sendTestEmail(to);
  return NextResponse.json({
    sentFrom: process.env.GMAIL_USER || null,
    sentTo: to,
    sameAccount: (process.env.GMAIL_USER || "").toLowerCase() === to.toLowerCase(),
    ...result,
  });
}
