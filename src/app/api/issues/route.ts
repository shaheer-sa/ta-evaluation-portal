export const runtime = "nodejs";

import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  issueCategoryLabel,
  sendIssueReportEmail,
  sendIssueReportThanksEmail,
  sendIssueResolvedEmail,
} from "@/lib/email/gmail";
import { pushForNotifications } from "@/lib/push";

// a few reports per student per hour is plenty, stops spam
const reportRateLimit = createRateLimiter({ tokens: 5, window: "1 h" });

const createSchema = z.object({
  category: z.enum(["bug", "display", "login", "suggestion", "other"]),
  message: z
    .string()
    .trim()
    .min(10, "Please describe the issue in at least 10 characters.")
    .max(2000, "Please keep it under 2000 characters."),
  pageUrl: z.string().trim().max(500).optional().nullable(),
});

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024; // the browser shrinks them well below this
const BUCKET = "issue-screenshots";

// check the actual file bytes, not just the name or the type the browser claims
function imageKind(buf: Buffer): { ext: string; type: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { ext: "png", type: "image/png" };
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return { ext: "webp", type: "image/webp" };
  return null;
}

const updateSchema = z.object({
  id: z.string().uuid("Invalid report."),
  status: z.enum(["open", "fixed"]),
});

/** POST /api/issues — a student reports a problem with the site */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name, roll_number, email")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "student") {
      return NextResponse.json({ error: "Only students can send issue reports." }, { status: 403 });
    }

    if (reportRateLimit) {
      const { success } = await reportRateLimit.limit(`issue-report:${user.id}`);
      if (!success) {
        return NextResponse.json(
          { error: "You've sent several reports recently. Please wait a bit before sending another." },
          { status: 429 }
        );
      }
    }

    // the form is sent as multipart (so screenshots can come along)
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Couldn't read your report. Please try again." }, { status: 400 });
    }

    const parsed = createSchema.safeParse({
      category: form.get("category"),
      message: form.get("message"),
      pageUrl: form.get("pageUrl"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { category, message } = parsed.data;
    // only keep the path, never a full url with someone else's domain in it
    const pageUrl = parsed.data.pageUrl?.startsWith("/") ? parsed.data.pageUrl : null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;

    const files = form
      .getAll("screenshots")
      .filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && f.size > 0);
    if (files.length > MAX_SCREENSHOTS) {
      return NextResponse.json({ error: `You can attach up to ${MAX_SCREENSHOTS} screenshots.` }, { status: 400 });
    }
    const shots: { content: Buffer; ext: string; type: string }[] = [];
    for (const f of files) {
      if (f.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json({ error: "A screenshot is too large (max 2 MB)." }, { status: 400 });
      }
      const content = Buffer.from(await f.arrayBuffer());
      const kind = imageKind(content);
      if (!kind) {
        return NextResponse.json({ error: "Screenshots must be JPG, PNG or WebP images." }, { status: 400 });
      }
      shots.push({ content, ...kind });
    }

    const admin = createAdminClient();
    const reportId = crypto.randomUUID();

    // files go in a private bucket under the student's own folder
    const paths: string[] = [];
    for (const [i, shot] of shots.entries()) {
      const path = `${user.id}/${reportId}/${i + 1}.${shot.ext}`;
      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, shot.content, {
        contentType: shot.type,
        upsert: false,
      });
      if (upErr) {
        console.error("screenshot upload failed:", { message: upErr.message, name: upErr.name });
        if (paths.length) await admin.storage.from(BUCKET).remove(paths);
        return NextResponse.json(
          { error: `Couldn't upload your screenshot (${upErr.message}). Try again, or send without it.` },
          { status: 500 }
        );
      }
      paths.push(path);
    }

    // saved by the server: we already checked above that this is a signed-in
    // student, and reporter_id / file paths are set here, not by the browser.
    // (any student can report a site problem, enrolled this term or not)
    const { data: report, error } = await admin
      .from("issue_reports")
      .insert({
        id: reportId,
        reporter_id: user.id,
        category,
        message,
        page_url: pageUrl,
        user_agent: userAgent,
        screenshot_paths: paths,
      })
      .select("id")
      .single();

    if (error || !report) {
      console.error("issue report insert failed:", { code: error?.code, message: error?.message, details: error?.details });
      if (paths.length) await admin.storage.from(BUCKET).remove(paths);
      // database not updated yet (sql step skipped)
      const missingSetup =
        error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205";
      // the code helps tell what went wrong without digging through logs
      const code = error?.code ? ` (code ${error.code})` : "";
      return NextResponse.json(
        {
          error: missingSetup
            ? `Reporting isn't fully set up yet${code}. Please tell your TA directly for now.`
            : `Couldn't send your report${code}. Please try again later.`,
        },
        { status: 500 }
      );
    }

    const { data: tas } = await admin.from("profiles").select("id, email").eq("role", "ta");
    const studentName = profile.full_name || "Student";
    const rollNumber = profile.roll_number || "";

    if (tas && tas.length > 0) {
      const notices = tas.map((ta) => ({
        recipient_id: ta.id,
        type: "issue_report",
        title: `Issue report: ${issueCategoryLabel(category)}`,
        body: `${studentName} (${rollNumber}): ${message.slice(0, 120)}${message.length > 120 ? "…" : ""}`,
        related_id: report.id,
      }));
      await admin.from("notifications").insert(notices);
      after(() => pushForNotifications(admin, notices));
    }

    // emails go out after the response so the student isn't kept waiting
    after(async () => {
      const jobs: Promise<unknown>[] = [];
      for (const ta of tas || []) {
        if (!ta.email) continue;
        jobs.push(
          sendIssueReportEmail({
            to: ta.email,
            studentName,
            rollNumber,
            category,
            message,
            pageUrl,
            reportId: report.id,
            screenshots: shots.map((shot, i) => ({
              filename: `screenshot-${i + 1}.${shot.ext}`,
              content: shot.content,
              contentType: shot.type,
            })),
          }).catch((err) => console.error("issue report email to ta failed:", err))
        );
      }
      if (profile.email) {
        jobs.push(
          sendIssueReportThanksEmail({
            to: profile.email,
            studentName,
            category,
            message,
            reportId: report.id,
          }).catch((err) => console.error("issue report thank-you email failed:", err))
        );
      }
      await Promise.allSettled(jobs);
    });

    return NextResponse.json({ success: true, reference: report.id.slice(0, 8).toUpperCase() });
  } catch (err) {
    console.error("issue report error:", err instanceof Error ? `${err.name}: ${err.message}` : err);
    const name = err instanceof Error ? err.name : "unknown";
    return NextResponse.json({ error: `Couldn't send your report (${name}). Please try again later.` }, { status: 500 });
  }
}

/** PATCH /api/issues — the ta marks a report fixed or reopens it */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "ta") {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { id, status } = parsed.data;

    const { data: updated, error } = await supabase
      .from("issue_reports")
      .update({ status, resolved_at: status === "fixed" ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id, category, message, reporter_id")
      .single();
    if (error || !updated) {
      console.error("issue report update failed:", error);
      const code = error?.code ? ` (code ${error.code})` : "";
      return NextResponse.json({ error: `Couldn't update the report${code}.` }, { status: 500 });
    }

    // let the student who reported it know it's been resolved (bell + email)
    if (status === "fixed") {
      const admin = createAdminClient();
      const ref = updated.id.slice(0, 8).toUpperCase();
      const { data: reporter } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", updated.reporter_id)
        .single();
      const notice = {
        recipient_id: updated.reporter_id,
        type: "issue_resolved",
        title: `Your report #${ref} has been resolved`,
        body: "Thank you for reporting it. The issue has been reviewed and fixed.",
        related_id: updated.id,
      };
      await admin.from("notifications").insert(notice);
      after(() => pushForNotifications(admin, [notice]));
      if (reporter?.email) {
        after(async () => {
          await sendIssueResolvedEmail({
            to: reporter.email as string,
            studentName: reporter.full_name || "Student",
            category: updated.category,
            message: updated.message,
            reportId: updated.id,
          }).catch((err) => console.error("issue resolved email failed:", err));
        });
      }
    }

    // the bell notification for this report is done with
    if (status === "fixed") {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("type", "issue_report")
        .eq("related_id", id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("issue report update error:", err);
    return NextResponse.json({ error: "Couldn't update the report." }, { status: 500 });
  }
}
