import nodemailer from "nodemailer";

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}

// plain text copy of the html body. mail apps still show the html one,
// but spam filters trust emails more when both versions are there
export function htmlToText(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return text && text !== href ? `${text}: ${href}` : href;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|blockquote|h[1-6]|li|tr)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  // give up instead of hanging if gmail is slow (default waits minutes)
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

// name shown in the inbox instead of the raw gmail address
function sender() {
  return {
    name: process.env.GMAIL_FROM_NAME || "TAMS",
    address: process.env.GMAIL_USER || "",
  };
}

type MailAttachment = { filename: string; content: Buffer; contentType: string };

async function sendMail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("sendMail aborted: invalid email address", to);
    return;
  }

  // Prevent header injection by stripping newlines from the subject
  const cleanSubject = subject.replace(/[\r\n]/g, "").trim();
  const safeSubject = `[TAMS] ${cleanSubject}`;

  const info = await transport.sendMail({
    from: sender(),
    to,
    replyTo: process.env.GMAIL_USER,
    subject: safeSubject,
    html,
    text: htmlToText(html),
    attachments,
  });
  console.log("email sent", { to, subject: safeSubject, response: info.response });
}

// used by the ta email check: tries gmail right away and reports what happened
export async function sendTestEmail(to: string): Promise<{ ok: true; response: string } | { ok: false; error: string }> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { ok: false, error: "GMAIL_USER or GMAIL_APP_PASSWORD is not set on the server." };
  }
  try {
    await transport.verify();
    const info = await transport.sendMail({
      from: sender(),
      to,
      subject: "[TAMS] Test email",
      html: "<p>If you can read this, TAMS can send emails.</p>",
      text: "If you can read this, TAMS can send emails.",
    });
    return { ok: true, response: String(info.response) };
  } catch (err) {
    console.error("test email failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendQueryEmail({
  to,
  studentName,
  queryTitle,
  kind,
  message,
  queryId,
  recipientRole,
  senderName,
}: {
  to: string;
  studentName: string;
  queryTitle: string;
  kind: "reply" | "status_change" | "new_query" | "student_reply";
  message: string;
  queryId: string;
  recipientRole: "student" | "ta";
  senderName?: string;
}) {
  const safeName = escapeHtml(studentName);
  const safeTitle = escapeHtml(queryTitle);
  const safeMessage = escapeHtmlMultiline(message);
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!siteUrl) {
    console.warn("sendQueryEmail warning: NEXT_PUBLIC_SITE_URL is empty, email links will be broken");
  }
  
  const path = recipientRole === "ta" ? "/ta/queries" : "/student/queries";
  const link = `${siteUrl}${path}?open=${queryId}`;

  let intro = `<p>The TA has ${kind === "reply" ? "replied to your query" : "changed the status of your query"} <strong>${safeTitle}</strong>:</p>`;
  if (kind === "new_query") {
    intro = `<p>A student has raised a new query <strong>${safeTitle}</strong>:</p>`;
  } else if (kind === "student_reply") {
    intro = `<p>${escapeHtml(senderName || "A student")} has replied to the query <strong>${safeTitle}</strong>:</p>`;
  }

  const html = `
    <p>Hi ${safeName},</p>
    ${intro}
    <blockquote style="border-left: 4px solid #ccc; padding-left: 1rem; margin-left: 0; color: #555;">
      ${safeMessage}
    </blockquote>
    <p><a href="${link}">View thread in TAMS</a></p>
  `;

  await sendMail({
    to,
    subject: queryTitle,
    html,
  });
}

export async function sendResetRequestEmail({
  to,
  taName,
  studentName,
  rollNumber,
  sectionName,
  studentId,
}: {
  to: string;
  taName: string;
  studentName: string;
  rollNumber: string;
  sectionName?: string | null;
  studentId: string;
}) {
  const safeTaName = escapeHtml(taName);
  const safeStudentName = escapeHtml(studentName);
  const safeRollNumber = escapeHtml(rollNumber);
  const safeSection = escapeHtml(sectionName || "unknown");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const link = `${siteUrl}/ta/roster?student=${encodeURIComponent(studentId)}`;

  const subject = `Password reset request: ${studentName} (${rollNumber})`;
  const html = `
    <p>Hi ${safeTaName},</p>
    <p>${safeStudentName} (${safeRollNumber}, Section ${safeSection}) asked for a password reset.</p>
    <p><a href="${link}">Open in TAMS</a></p>
  `;

  await sendMail({
    to,
    subject,
    html,
  });
}

export async function sendPasswordResetDoneEmail({
  to,
  studentName,
  rollNumber,
}: {
  to: string;
  studentName: string;
  rollNumber: string;
}) {
  const safeStudentName = escapeHtml(studentName);
  const safeRollNumber = escapeHtml(rollNumber);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const loginLink = `${siteUrl}/login`;

  const subject = "Your password has been reset";
  const html = `
    <p>Hi ${safeStudentName},</p>
    <p>Your TA has reset your TAMS password. Temporary password: <b>Tams@${safeRollNumber}</b>.</p>
    <p>Sign in at <a href="${loginLink}">${loginLink}</a> with your roll number and this password. You'll be asked to choose a new password straight away.</p>
  `;

  await sendMail({
    to,
    subject,
    html,
  });
}

const ISSUE_CATEGORY_LABELS: Record<string, string> = {
  bug: "Something isn't working",
  display: "Something looks wrong",
  login: "Login or password",
  suggestion: "Suggestion",
  other: "Other",
};

export function issueCategoryLabel(category: string): string {
  return ISSUE_CATEGORY_LABELS[category] || "Other";
}

// to the ta: a student reported a problem with the site
export async function sendIssueReportEmail({
  to,
  studentName,
  rollNumber,
  category,
  message,
  pageUrl,
  reportId,
  screenshots,
}: {
  to: string;
  studentName: string;
  rollNumber: string;
  category: string;
  message: string;
  pageUrl?: string | null;
  reportId: string;
  screenshots?: MailAttachment[];
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const link = `${siteUrl}/ta/reports?open=${encodeURIComponent(reportId)}`;
  const label = issueCategoryLabel(category);

  const html = `
    <p>${escapeHtml(studentName)} (${escapeHtml(rollNumber)}) reported an issue.</p>
    <p><strong>Type:</strong> ${escapeHtml(label)}</p>
    ${pageUrl ? `<p><strong>Page:</strong> ${escapeHtml(pageUrl)}</p>` : ""}
    <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${escapeHtmlMultiline(message)}</blockquote>
    ${screenshots && screenshots.length > 0 ? `<p>${screenshots.length} screenshot${screenshots.length > 1 ? "s" : ""} attached.</p>` : ""}
    <p><a href="${link}">Open in TAMS</a></p>
  `;

  await sendMail({
    to,
    subject: `Issue report: ${label} from ${studentName} (${rollNumber})`,
    html,
    attachments: screenshots,
  });
}

// to the student: automatic thank-you after they report an issue
export async function sendIssueReportThanksEmail({
  to,
  studentName,
  category,
  message,
  reportId,
}: {
  to: string;
  studentName: string;
  category: string;
  message: string;
  reportId: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const ref = reportId.slice(0, 8).toUpperCase();

  const html = `
    <p>Hi ${escapeHtml(studentName)},</p>
    <p>Thank you for reporting this issue. We really appreciate you taking the time to let us know, it helps make TAMS better for everyone.</p>
    <p>Your report has been received and will be reviewed. If it needs a fix, it will be fixed as soon as possible after the review.</p>
    <p><strong>Reference:</strong> #${escapeHtml(ref)}<br/>
    <strong>Type:</strong> ${escapeHtml(issueCategoryLabel(category))}</p>
    <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${escapeHtmlMultiline(message)}</blockquote>
    <p>If your question is about your marks, please use <a href="${siteUrl}/student/queries">My Queries</a> in TAMS instead, so it reaches your TA directly.</p>
    <p>Thanks again,<br/>TAMS</p>
    <p style="color:#888;font-size:12px">This is an automatic message, there's no need to reply.</p>
  `;

  await sendMail({
    to,
    subject: `We received your issue report (#${ref})`,
    html,
  });
}

// to the student: the issue they reported has been fixed
export async function sendIssueResolvedEmail({
  to,
  studentName,
  category,
  message,
  reportId,
}: {
  to: string;
  studentName: string;
  category: string;
  message: string;
  reportId: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const ref = reportId.slice(0, 8).toUpperCase();

  const html = `
    <p>Hi ${escapeHtml(studentName)},</p>
    <p>Good news: the issue you reported has been reviewed and resolved.</p>
    <p><strong>Reference:</strong> #${escapeHtml(ref)}<br/>
    <strong>Type:</strong> ${escapeHtml(issueCategoryLabel(category))}</p>
    <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${escapeHtmlMultiline(message)}</blockquote>
    <p>If you still see the problem, please open <a href="${siteUrl}/student">TAMS</a> and report it again with a short note, so it can be looked at once more.</p>
    <p>Thank you for helping improve TAMS.</p>
    <p>Regards,<br/>TAMS</p>
    <p style="color:#888;font-size:12px">This is an automatic message, there's no need to reply.</p>
  `;

  await sendMail({
    to,
    subject: `Your issue report #${ref} has been resolved`,
    html,
  });
}

// to the student, once a day at most: new marks they haven't seen in TAMS yet
export async function sendMarksDigestEmail({
  to,
  studentName,
  courses,
}: {
  to: string;
  studentName: string;
  courses: { title: string; assessments: string; enrollmentId: string | null }[];
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const list = courses
    .map(
      (c) =>
        `<li style="margin-bottom:6px"><strong>${escapeHtml(c.title)}</strong>: ${escapeHtml(c.assessments)}${
          c.enrollmentId
            ? ` (<a href="${siteUrl}/student/course/${encodeURIComponent(c.enrollmentId)}">view marks</a>)`
            : ""
        }</li>`
    )
    .join("");

  const html = `
    <p>Hi ${escapeHtml(studentName)},</p>
    <p>New marks have been posted in TAMS:</p>
    <ul style="padding-left:18px">${list}</ul>
    <p>You can see the full breakdown, including your totals, on your course page in <a href="${siteUrl}/student">TAMS</a>.</p>
    <p>If you think a mark is incorrect, please submit a query from My Queries in TAMS.</p>
    <p>Regards,<br/>TAMS</p>
    <p style="color:#888;font-size:12px">You are receiving this because you turned on marks emails in TAMS. You can turn them off at any time from the notifications panel in TAMS.</p>
  `;

  await sendMail({ to, subject: "New marks posted in TAMS", html });
}

// to the student, once per release: what's new, if they haven't read it in TAMS
export async function sendReleaseDigestEmail({
  to,
  studentName,
  releases,
}: {
  to: string;
  studentName: string;
  releases: { title: string; date: string; items: { kind: string; title: string; body: string }[] }[];
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const sections = releases
    .map(
      (r) => `
      <p style="margin-bottom:4px"><strong>TAMS ${escapeHtml(r.title)}</strong> <span style="color:#888">· ${escapeHtml(r.date)}</span></p>
      <ul style="padding-left:18px;margin-top:4px">
        ${r.items
          .map(
            (i) =>
              `<li style="margin-bottom:6px"><strong>${escapeHtml(i.title)}</strong> (${escapeHtml(i.kind)}): ${escapeHtml(i.body)}</li>`
          )
          .join("")}
      </ul>`
    )
    .join("");

  const html = `
    <p>Hi ${escapeHtml(studentName)},</p>
    <p>Here is what's new in TAMS:</p>
    ${sections}
    <p>You can read all release notes on the <a href="${siteUrl}/student/updates">What's New</a> page in TAMS.</p>
    <p>Regards,<br/>TAMS</p>
    <p style="color:#888;font-size:12px">You receive this email once per update, only if you haven't already read it in TAMS.</p>
  `;

  const subject = releases.length === 1 ? `What's new in TAMS: ${releases[0].title}` : "What's new in TAMS";
  await sendMail({ to, subject, html });
}
