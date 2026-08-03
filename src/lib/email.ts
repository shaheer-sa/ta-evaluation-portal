import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Note: Use a verified domain if moving to production. 
// "onboarding@resend.dev" only works if 'to' is the registered Resend account email
// during the free tier / testing phase.
const FROM_EMAIL = "TAMS <onboarding@resend.dev>";

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
    return;
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

    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    return null;
  }
}
