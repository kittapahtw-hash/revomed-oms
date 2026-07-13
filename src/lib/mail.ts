import "server-only";
import { Resend } from "resend";

export async function sendMail(to: string[], subject: string, html: string) {
  const keyStr = process.env.RESEND_API_KEY;
  if (!keyStr || !to.length) return { ok: false, skipped: true };
  const resend = new Resend(keyStr);
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM || "OMS <onboarding@resend.dev>",
    to, subject, html,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
