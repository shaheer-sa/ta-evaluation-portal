import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sender address.
 *
 * Resend's shared `onboarding@resend.dev` sender only delivers to the email
 * address that owns the Resend account -- every message to a student is
 * accepted by the API and then silently dropped. Verify a domain in the
 * Resend dashboard and set RESEND_FROM_EMAIL to something like
 * "TAMS <noreply@yourdomain.com>" for real delivery.
 */
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "TAMS <onboarding@resend.dev>";

const USING_SHARED_SENDER = !process.env.RESEND_FROM_EMAIL;

/**
 * Escapes user-supplied text for safe interpolation into an HTML email body.
 *
 * Query titles and descriptions are written by students and were previously
 * dropped into the email template raw, so a description containing markup
 * could inject arbitrary HTML (including links) into a message the TA
 * receives from a trusted-looking sender.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes text and converts newlines to <br/> for multi-line email bodies. */
export function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}

export async function sendEmailNotification(
  to: string,
  subject: string,
  html: string
) {
  if (
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.includes("placeholder")
  ) {
    console.log("Skipping email (missing or placeholder API key):", {
      to,
      subject,
    });
    return null;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return null;
    }

    if (USING_SHARED_SENDER) {
      console.warn(
        `Sent "${subject}" via the shared onboarding@resend.dev sender. ` +
          `Delivery to ${to} will only succeed if it matches your Resend ` +
          `account email. Set RESEND_FROM_EMAIL with a verified domain.`
      );
    }

    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    return null;
  }
}
