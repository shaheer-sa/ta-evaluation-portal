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
}: {
  to: string;
  studentName: string;
  queryTitle: string;
  kind: "reply" | "status_change";
  message: string;
  queryId: string;
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
  
  const link = `${siteUrl}/student/queries?open=${queryId}`;

  const actionText = kind === "reply" ? "replied to your query" : "changed the status of your query";

  const html = `
    <p>Hi ${safeName},</p>
    <p>The TA has ${actionText} <strong>${safeTitle}</strong>:</p>
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
