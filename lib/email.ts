import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !port || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: parseInt(port) === 465,
    auth: { user, pass },
    // Fail fast on a misbehaving SMTP endpoint. Without these,
    // nodemailer's defaults are ~3 minutes total, which on a serverless
    // host means a stuck connection eats the entire function lifetime
    // and the welcome email never sends. A real customer hit this
    // 2026-05-10 — attempt 1 hung 90s before erroring with "Greeting
    // never received" while the SMTP provider was throttling burst
    // traffic. With these timeouts each attempt errors within ~10s,
    // letting the retry chain complete inside the signup request.
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  from?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    console.warn("Email not sent — SMTP not configured");
    return { success: false, error: "SMTP not configured" };
  }

  const fromAddress = opts.from || process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await t.sendMail({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    return { success: true };
  } catch (err: any) {
    console.error("Email send failed:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}
