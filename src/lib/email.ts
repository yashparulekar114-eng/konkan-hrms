import "server-only";
import { Resend } from "resend";
import { query } from "./db";

// Every email is saved in email_log (visible on the Outbox page). If RESEND_API_KEY is set it is also really sent.
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  let sentVia = "outbox only";
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const resend = new Resend(key);
      await resend.emails.send({ from: "KonkanHR <onboarding@resend.dev>", to, subject, text: body });
      sentVia = "resend";
    } catch (err) {
      console.error("Resend failed, kept in outbox only", err);
    }
  }
  await query("insert into email_log (to_email, subject, body, sent_via) values ($1, $2, $3, $4)", [
    to,
    subject,
    body,
    sentVia,
  ]);
}
