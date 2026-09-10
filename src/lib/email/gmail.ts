import nodemailer from "nodemailer";
import { escapeHtml, escapeHtmlMultiline } from "../email";

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

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
  
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("sendQueryEmail aborted: invalid email address", to);
    return;
  }

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

  // Prevent header injection by stripping newlines from the subject
  const safeSubject = `[TAMS] ${safeTitle}`.replace(/[\r\n]/g, "");

  await transport.sendMail({
    from: process.env.GMAIL_USER,
    to,
    replyTo: process.env.GMAIL_USER,
    subject: safeSubject,
    html,
  });
}
