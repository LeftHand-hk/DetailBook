import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// 3-email onboarding sequence sent over 13 days from signup. Email 1
// goes out immediately from the signup handler; emails 2 and 3 are
// dispatched by the hourly cron at /api/cron/welcome-emails.

export type WelcomeEmailNumber = 1 | 2 | 3;

const FROM_NAME = "Ardit from DetailBook";
const FROM_ADDRESS = process.env.SMTP_FROM || "info@detailbookapp.com";
const REPLY_TO = "info@detailbookapp.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://detailbookapp.com";

type Recipient = {
  id: string;
  email: string;
  businessName: string;
  slug: string;
  welcomeUnsubToken: string | null;
};

function unsubLink(token: string): string {
  return `${APP_URL}/api/welcome-unsubscribe?t=${token}`;
}

function bookingLink(slug: string): string {
  return `${APP_URL}/book/${slug}`;
}

function plainSignature(): string {
  return `Ardit\nFounder, DetailBook\ndetailbookapp.com`;
}

function plainFooter(unsubUrl: string): string {
  return `\n\n---\nDon't want these? Unsubscribe: ${unsubUrl}`;
}

// Minimal HTML wrapper. Looks like a personal email — no banner, no
// logo, no marketing chrome. Plain sans-serif, single CTA per email.
function htmlWrap(bodyParagraphsHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DetailBook</title></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;background:#fff;">
    ${bodyParagraphsHtml}
    <p style="margin:24px 0 0 0;color:#111;">Ardit<br>Founder, DetailBook<br><a href="${APP_URL}" style="color:#111;text-decoration:underline;">detailbookapp.com</a></p>
    <p style="margin:32px 0 0 0;font-size:11px;color:#999;line-height:1.5;">
      <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe from these emails</a>
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphsToHtml(paragraphs: string[]): string {
  return paragraphs
    .map((p) => {
      // Preserve line breaks within a paragraph (used for numbered lists).
      const lines = p.split("\n").map((l) => escapeHtml(l));
      return `<p style="margin:0 0 14px 0;">${lines.join("<br>")}</p>`;
    })
    .join("");
}

// Linkify a single dashboard URL inside an HTML chunk. We do this
// after escaping so the URL becomes a real <a> instead of being
// rendered as plain text.
function linkifyDashboard(html: string): string {
  const urlPlain = `${APP_URL}/dashboard`;
  const urlBilling = `${APP_URL}/dashboard/billing`;
  return html
    .replace(
      escapeHtml(urlBilling),
      `<a href="${urlBilling}" style="color:#2563eb;text-decoration:underline;">${urlBilling}</a>`,
    )
    .replace(
      escapeHtml(urlPlain),
      `<a href="${urlPlain}" style="color:#2563eb;text-decoration:underline;">${urlPlain}</a>`,
    );
}

// ─── Templates ────────────────────────────────────────────────────────

function email1(r: Recipient, unsubUrl: string) {
  const subject = `Welcome to DetailBook, ${r.businessName}`;
  const paragraphs = [
    `Hey,`,
    `Thanks for signing up for DetailBook — really appreciate you giving us a try.`,
    `I'm Ardit, the founder. I built DetailBook because I saw too many detailers losing money to no-shows and chaotic scheduling. Hopefully it helps you take that off your plate.`,
    `Your account is ready. Here's how to get started:`,
    `1. Set your working hours\n2. Add your service packages (start with 2-3)\n3. Configure deposits to stop no-shows\n4. Share your booking link`,
    `The setup takes about 5 minutes total. There's a checklist on your dashboard that walks you through it.`,
    `→ Continue setup: ${APP_URL}/dashboard`,
    `If you get stuck anywhere, just hit reply. I read every email personally and usually respond within a few hours.`,
    `Welcome aboard,`,
  ];
  const text = paragraphs.join("\n\n") + "\n\n" + plainSignature() + plainFooter(unsubUrl);
  const html = htmlWrap(linkifyDashboard(paragraphsToHtml(paragraphs)), unsubUrl);
  return { subject, text, html };
}

function email2(_r: Recipient, unsubUrl: string) {
  const subject = `Where to share your booking link`;
  const paragraphs = [
    `Hey,`,
    `Now that your DetailBook account is set up, here's where to share your booking link to start getting customers:`,
    `1. Instagram bio — replace your phone number with the link\n2. Facebook page "Book Now" button\n3. Reply to existing customer DMs/texts with the link\n4. WhatsApp business profile\n5. Email signature`,
    `The detailers seeing the most traction are the ones who replace phone-tag with this link. One detailer I work with got 8 bookings the first week just by adding it to his Instagram bio.`,
    `→ Copy your link: ${APP_URL}/dashboard`,
    `Want help promoting it? Reply and I'll send you specific ideas based on where your customers come from.`,
  ];
  const text = paragraphs.join("\n\n") + "\n\n" + plainSignature() + plainFooter(unsubUrl);
  const html = htmlWrap(linkifyDashboard(paragraphsToHtml(paragraphs)), unsubUrl);
  return { subject, text, html };
}

function email3(_r: Recipient, unsubUrl: string) {
  const subject = `Your DetailBook trial ends in 2 days`;
  const paragraphs = [
    `Hey,`,
    `Heads up — your DetailBook trial ends in 2 days.`,
    `If you've found it useful and want to keep using it, here are your options:`,
    `Starter — $29/month\nCustom booking page, 5 packages, deposit collection, email reminders, calendar dashboard`,
    `Pro — $50/month\nEverything in Starter + unlimited packages, SMS reminders, Google Calendar sync, multiple staff, custom domain, priority support`,
    `→ Choose your plan: ${APP_URL}/dashboard/billing`,
    `Cancel anytime. No setup fees. Your data stays yours.`,
    `If DetailBook isn't quite right for you, just reply with your reason — your feedback helps me improve it for the next detailer.`,
    `Either way, thanks for the chance.`,
  ];
  const text = paragraphs.join("\n\n") + "\n\n" + plainSignature() + plainFooter(unsubUrl);
  const html = htmlWrap(linkifyDashboard(paragraphsToHtml(paragraphs)), unsubUrl);
  return { subject, text, html };
}

function buildEmail(num: WelcomeEmailNumber, r: Recipient, unsubUrl: string) {
  switch (num) {
    case 1:
      return email1(r, unsubUrl);
    case 2:
      return email2(r, unsubUrl);
    case 3:
      return email3(r, unsubUrl);
  }
}

// Ensure the user has an unsubscribe token; mint one lazily if missing.
async function ensureUnsubToken(userId: string, current: string | null): Promise<string> {
  if (current && current.length > 0) return current;
  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { welcomeUnsubToken: token },
  });
  return token;
}

// Send a specific welcome email. Used by:
//   - signup handler (num=1)
//   - hourly cron (num=2 or 3)
//   - admin test endpoint (any num, optional override-recipient)
//
// When `overrideTo` is provided, sends to that address WITHOUT updating
// any DB tracking — used for the admin test button.
export async function sendWelcomeEmail(
  userId: string,
  num: WelcomeEmailNumber,
  options: { overrideTo?: string } = {},
): Promise<{ success: boolean; error?: string; sentTo?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      businessName: true,
      slug: true,
      welcomeUnsubToken: true,
      welcomeEmailsPaused: true,
      suspended: true,
      subscriptionStatus: true,
    },
  });
  if (!user) return { success: false, error: "user_not_found" };

  // Guards (unless this is an admin test send).
  if (!options.overrideTo) {
    if (user.welcomeEmailsPaused) return { success: false, error: "paused" };
    if (user.suspended) return { success: false, error: "suspended" };

    // Skip Email 3 (trial ending) if user is already on a paid plan.
    if (num === 3) {
      const status = (user.subscriptionStatus || "").toLowerCase();
      if (status === "active" || status === "past_due") {
        return { success: false, error: "already_subscribed" };
      }
    }
  }

  const token = await ensureUnsubToken(user.id, user.welcomeUnsubToken);
  const unsubUrl = unsubLink(token);
  const recipient: Recipient = {
    id: user.id,
    email: user.email,
    businessName: user.businessName,
    slug: user.slug,
    welcomeUnsubToken: token,
  };

  const { subject, text, html } = buildEmail(num, recipient, unsubUrl);

  // Helpful unused-variable suppressor — `bookingLink` is exported in
  // case templates need it later, but isn't currently embedded in copy.
  void bookingLink;

  const sentTo = options.overrideTo || user.email;
  const result = await sendEmail({
    to: sentTo,
    subject,
    text,
    html,
    from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    replyTo: REPLY_TO,
  });

  if (!result.success) {
    return { success: false, error: result.error || "send_failed", sentTo };
  }

  // Only persist tracking when sending to the real user.
  if (!options.overrideTo) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        welcomeEmailsSent: num,
        welcomeEmailLastSentAt: new Date(),
      },
    });
    console.log(`[welcome-emails] sent #${num} to ${user.email}`);
  }

  return { success: true, sentTo };
}

// Decide which email number is due for a user, or null if none.
// Cadence (anchored on createdAt):
//   email 1 — Day 0 (signup; cron also re-tries if signup failed)
//   email 2 — Day 5
//   email 3 — Day 13
export function decideNextEmail(user: {
  createdAt: Date;
  welcomeEmailsSent: number;
  welcomeEmailsPaused: boolean;
  suspended: boolean;
  subscriptionStatus: string | null;
}, now: Date = new Date()): WelcomeEmailNumber | null {
  if (user.welcomeEmailsPaused || user.suspended) return null;

  const ageMs = now.getTime() - user.createdAt.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (user.welcomeEmailsSent < 1) return 1;
  if (user.welcomeEmailsSent < 2 && ageDays >= 5) return 2;
  if (user.welcomeEmailsSent < 3 && ageDays >= 13) {
    const status = (user.subscriptionStatus || "").toLowerCase();
    if (status === "active" || status === "past_due") return null;
    return 3;
  }
  return null;
}

// Used by the cron route. Pulls candidates and sends due email to each.
export async function runWelcomeSequenceTick(): Promise<{
  checked: number;
  sent: { email: string; num: WelcomeEmailNumber }[];
  skipped: { email: string; reason: string }[];
}> {
  // Cap the window to "created in the last 30 days" so we don't scan
  // the whole users table forever once the sequence is finished.
  const sinceCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      createdAt: { gte: sinceCutoff },
      welcomeEmailsPaused: false,
      suspended: false,
      welcomeEmailsSent: { lt: 3 },
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      welcomeEmailsSent: true,
      welcomeEmailsPaused: true,
      suspended: true,
      subscriptionStatus: true,
    },
  });

  const sent: { email: string; num: WelcomeEmailNumber }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const u of candidates) {
    const next = decideNextEmail(u);
    if (!next) {
      skipped.push({ email: u.email, reason: "not_due" });
      continue;
    }
    const result = await sendWelcomeEmail(u.id, next);
    if (result.success) {
      sent.push({ email: u.email, num: next });
    } else {
      skipped.push({ email: u.email, reason: result.error || "send_failed" });
    }
  }

  return { checked: candidates.length, sent, skipped };
}
