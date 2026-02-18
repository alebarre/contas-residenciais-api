import nodemailer from "nodemailer";
import { env } from "../env";

type SendParams = {
  to: string;
  subject: string;
  text: string;
};

function hasSmtpConfigured(): boolean {
  return !!(
    env.SMTP_HOST &&
    env.SMTP_PORT &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    env.SMTP_FROM
  );
}

export async function sendMail({
  to,
  subject,
  text,
}: SendParams): Promise<void> {
  // Se não tiver SMTP, loga (dev) — mantém MVP funcionando.
  if (!hasSmtpConfigured()) {
    console.log(`[MAILER] SMTP não configurado. Email para: ${to}`);
    console.log(`[MAILER] Subject: ${subject}`);
    console.log(`[MAILER] Content:\n${text}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
  });
}
