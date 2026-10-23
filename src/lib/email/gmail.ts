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

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendMail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("sendMail aborted: invalid email address", to);
    return;
  }

  // Prevent header injection by stripping newlines from the subject
  const cleanSubject = subject.replace(/[\r\n]/g, "").trim();
  const safeSubject = `[TAMS] ${cleanSubject}`;

  await transport.sendMail({
    from: process.env.GMAIL_USER,
    to,
    replyTo: process.env.GMAIL_USER,
    subject: safeSubject,
    html,
  });
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
