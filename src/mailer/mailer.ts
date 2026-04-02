import { Resend } from "resend";
import { env } from "../env";

type SendParams = {
  to: string;
  subject: string;
  text: string;
};

function hasEmailConfigured(): boolean {
  return !!(env.RESEND_API_KEY && env.MAIL_FROM);
}

export async function sendMail({
  to,
  subject,
  text,
}: SendParams): Promise<void> {
  if (!hasEmailConfigured()) {
    console.log(`[MAILER] Resend não configurado. Email para: ${to}`);
    console.log(`[MAILER] Subject: ${subject}`);
    console.log(`[MAILER] Content:\n${text}`);
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);

  await resend.emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    text,
  });
}
