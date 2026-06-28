import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { fetchPaddleSubscriptionStatus } from "@/lib/paddle";

// 4-email trial sequence anchored on SIGNUP (createdAt). The trial is
// no-card and tracked in our own DB, so these go to anyone in an active
// trial — no card or Paddle subscription required. Legacy card-on-file
// trials still flow through the same steps.
//
//   day1 — welcome + setup guide (sent by the hourly cron after signup)
//   day3 — "need a hand setting up?" check-in
//   day5 — "2 days left" reminder + share-link push
//   day7 — "trial ends today" — SKIPPED if the user already converted
//          to active before day 7
//
// Storage columns are the legacy welcomeEmailDay0At / Day2At / Day5At /
// Day13At columns; we just repurpose them as day1/day3/day5/day7 so
// nothing in the database has to migrate.

export type WelcomeEmailKey = "day1" | "day3" | "day5" | "day7";

const FROM_NAME = "Ardit from DetailBook";
const FROM_ADDRESS = process.env.SMTP_FROM || "info@detailbookapp.com";
const REPLY_TO = "info@detailbookapp.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://detailbookapp.com";

// In-call retry policy. Three attempts with exponential backoff so a
// blip in the SMTP provider doesn't kill the send. The cron itself
// also retries Day 0 sends an hour later if all three of these fail.
const RETRY_DELAYS_MS = [1000, 4000];

export type WelcomeRecipient = {
  id: string;
  email: string;
  businessName: string;
  slug: string;
  // Full name from signup ("Mike Anderson"); first_name is split off
  // in the templates that need a personal greeting.
  name: string;
  // ISO date string of when the trial ends. Day 0 email shows this so
  // the user knows the exact date their trial runs out.
  trialEndsAt: string;
  packageCount: number;
  hasWorkingHours: boolean;
  hasCustomizedPage: boolean;
  hasSharedLink: boolean;
};
type Recipient = WelcomeRecipient;

type NextAction = {
  title: string;
  description: string;
  cta: string;
  url: string;
};

function unsubLink(token: string): string {
  return `${APP_URL}/api/welcome-unsubscribe?t=${token}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Templates ────────────────────────────────────────────────────────

// Brand-html wrapper shared by every email in the new trial sequence so
// the four messages look consistent and copy stays clean. Mirrors the
// look of the existing payment-failed email below.
function tplShell(bodyHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DetailBook</title></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#111;background:#fff;">
${bodyHtml}
    <p style="margin:18px 0 6px 0;">Ardit<br><span style="color:#6b7280;">DetailBook</span></p>
    <p style="margin:32px 0 0 0;font-size:11px;color:#999;line-height:1.5;">
      <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe from these emails</a>
    </p>
  </div>
</body></html>`;
}

function tplSignatureText(unsubUrl: string): string {
  return `\n\nArdit\nDetailBook\n\n---\nDon't want these? Unsubscribe: ${unsubUrl}`;
}

function bookingUrlFor(r: Recipient): string {
  return r.slug ? `${APP_URL}/book/${r.slug}` : `${APP_URL}/dashboard`;
}

function nextActionFor(r: Recipient): NextAction {
  if (r.packageCount === 0) {
    return {
      title: "Add your first service package",
      description: "Customers need at least one service to book. Add its name, price, duration, and the vehicle types you accept.",
      cta: "Add a service package",
      url: `${APP_URL}/dashboard/packages?setup=services`,
    };
  }
  if (!r.hasWorkingHours) {
    return {
      title: "Set your working hours",
      description: "Choose when customers can book. DetailBook automatically blocks times outside your availability.",
      cta: "Set working hours",
      url: `${APP_URL}/dashboard/settings`,
    };
  }
  if (!r.hasCustomizedPage) {
    return {
      title: "Make the booking page yours",
      description: "Add your logo, business introduction, photos, and branding so customers immediately recognize your business.",
      cta: "Customize booking page",
      url: `${APP_URL}/dashboard/booking-page`,
    };
  }
  if (!r.hasSharedLink) {
    return {
      title: "Share your booking link",
      description: "Your page is ready. Send the link to a customer or add it to Instagram, Facebook, or your Google Business profile.",
      cta: "View booking page",
      url: bookingUrlFor(r),
    };
  }
  return {
    title: "Your booking page is ready",
    description: "Your core setup is complete. Keep sharing your booking link and manage new appointments from the dashboard.",
    cta: "Open dashboard",
    url: `${APP_URL}/dashboard`,
  };
}

function progressRows(r: Recipient): Array<{ label: string; status: string }> {
  return [
    { label: "Service packages", status: r.packageCount > 0 ? "Completed" : "Not completed" },
    { label: "Working hours", status: r.hasWorkingHours ? "Completed" : "Not completed" },
    { label: "Booking page", status: r.hasCustomizedPage ? "Customized" : "Not customized" },
    { label: "Booking link", status: r.hasSharedLink ? "Shared" : "Not shared" },
  ];
}

// ─── Day 1 — Welcome ────────────────────────────────────────────────
function emailDay1(r: Recipient, unsubUrl: string) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const bookingLink = bookingUrlFor(r);
  const e = escapeHtml;
  const subject = `Welcome to DetailBook, ${firstName}`;

  const text = `Hi ${firstName},

Thank you for trying DetailBook.

DetailBook gives your detailing business one place to manage your services, bookings, customers, calendar, deposits, and reminders.

During your 7-day trial, you can:

- Create service packages with prices and durations
- Build a professional booking page
- Let customers choose a service and available time
- Collect deposits to reduce no-shows
- Manage bookings and customers from your dashboard
- Share one booking link anywhere you promote your business

Your booking page:
${bookingLink}

Start by adding your services and making the booking page match your business. If you need help at any point, reply to this email. I personally read every response.${tplSignatureText(unsubUrl)}`;

  const html = tplShell(`
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">Thank you for trying DetailBook.</p>
    <p style="margin:0 0 14px 0;">DetailBook gives your detailing business one place to manage your services, bookings, customers, calendar, deposits, and reminders.</p>
    <p style="margin:0 0 10px 0;">During your 7-day trial, you can:</p>
    <ul style="margin:0 0 14px 0;padding-left:22px;">
      <li>Create service packages with prices and durations</li>
      <li>Build a professional booking page</li>
      <li>Let customers choose a service and available time</li>
      <li>Collect deposits to reduce no-shows</li>
      <li>Manage bookings and customers from your dashboard</li>
      <li>Share one booking link anywhere you promote your business</li>
    </ul>
    <p style="margin:0 0 8px 0;"><strong>Your booking page:</strong></p>
    <p style="margin:0 0 14px 0;"><a href="${bookingLink}" style="color:#2563eb;text-decoration:underline;">${e(bookingLink)}</a></p>
    <p style="margin:0 0 14px 0;">Start by adding your services and making the booking page match your business. If you need help at any point, reply to this email. I personally read every response.</p>`,
    unsubUrl);

  return { subject, text, html };
}

// ─── Day 3 — Account-specific next action ───────────────────────────
function emailDay3(r: Recipient, unsubUrl: string) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const e = escapeHtml;
  const subject = `Let's finish your DetailBook booking page`;
  const action = nextActionFor(r);

  const text = `Hi ${firstName},

Your DetailBook trial is underway. Here's the most useful next step for your account:

${action.title}

${action.description}

${action.cta}: ${action.url}

Need help finishing it? Reply with your services, prices, or any questions and I'll help you personally.${tplSignatureText(unsubUrl)}`;

  const html = tplShell(`
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">Your DetailBook trial is underway. Here&rsquo;s the most useful next step for your account:</p>
    <h2 style="margin:0 0 8px 0;font-size:18px;line-height:1.35;">${e(action.title)}</h2>
    <p style="margin:0 0 18px 0;">${e(action.description)}</p>
    <p style="margin:0 0 20px 0;"><a href="${action.url}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;">${e(action.cta)}</a></p>
    <p style="margin:0 0 14px 0;">Need help finishing it? Reply with your services, prices, or any questions and I&rsquo;ll help you personally.</p>`,
    unsubUrl);

  return { subject, text, html };
}

// ─── Day 5 — 2 days left + share-link push ─────────────────────────
function emailDay5(r: Recipient, unsubUrl: string) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const bookingLink = bookingUrlFor(r);
  const e = escapeHtml;
  const subject = `Your DetailBook trial ends in 2 days`;
  const rows = progressRows(r);
  const progressText = rows
    .map((row) => `- ${row.label}: ${row.status}`)
    .join("\n");
  const progressHtml = rows
    .map((row) => `<li style="margin-bottom:5px;"><strong>${e(row.label)}:</strong> ${e(row.status)}</li>`)
    .join("");

  const text = `Hi ${firstName},

You have two days remaining in your DetailBook trial.

Your services, bookings, customers, and settings will remain saved, but your public booking page will pause when the trial ends unless you subscribe.

Your current progress:
${progressText}

Your booking page:
${bookingLink}

To keep it live after the trial, choose a plan from Billing:
${APP_URL}/dashboard/billing

If you need help getting everything ready before the trial ends, reply to this email. I'll be happy to help.${tplSignatureText(unsubUrl)}`;

  const html = tplShell(`
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">You have two days remaining in your DetailBook trial.</p>
    <p style="margin:0 0 14px 0;">Your services, bookings, customers, and settings will remain saved, but your public booking page will pause when the trial ends unless you subscribe.</p>
    <p style="margin:0 0 8px 0;"><strong>Your current progress:</strong></p>
    <ul style="margin:0 0 14px 0;padding-left:22px;">${progressHtml}</ul>
    <p style="margin:0 0 8px 0;"><strong>Your booking page:</strong></p>
    <p style="margin:0 0 14px 0;"><a href="${bookingLink}" style="color:#2563eb;text-decoration:underline;">${e(bookingLink)}</a></p>
    <p style="margin:0 0 20px 0;"><a href="${APP_URL}/dashboard/billing" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;">View plans</a></p>
    <p style="margin:0 0 14px 0;">If you need help getting everything ready before the trial ends, reply to this email. I&rsquo;ll be happy to help.</p>`,
    unsubUrl);

  return { subject, text, html };
}

// ─── Day 7 — Trial ends today (skip if already converted) ──────────
function emailDay7(r: Recipient, unsubUrl: string) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const e = escapeHtml;
  const subject = `Your trial ends today — your booking page goes offline tonight`;

  const text = `Hi ${firstName},

Your 7-day trial ends today — and when it does, your booking page goes offline. Anyone who opens your link won't be able to book you or pay a deposit.

Keep your page live and keep taking bookings — choose a plan before today ends:
${APP_URL}/dashboard/billing

Plans start at $24 per month and can be canceled anytime.

Nothing gets deleted — your packages, bookings, customers, and settings stay saved if you reactivate later. But your page stays offline until you do.

Need help deciding or setting something up? Reply to this email and I'll help you personally.${tplSignatureText(unsubUrl)}`;

  const html = tplShell(`
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">Your 7-day trial ends today — and when it does, <strong>your booking page goes offline</strong>. Anyone who opens your link won&rsquo;t be able to book you or pay a deposit.</p>
    <p style="margin:0 0 20px 0;"><a href="${APP_URL}/dashboard/billing" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Keep my booking page live</a></p>
    <p style="margin:0 0 14px 0;">Plans start at $24 per month and can be canceled anytime.</p>
    <p style="margin:0 0 14px 0;">Nothing gets deleted — your packages, bookings, customers, and settings stay saved if you reactivate later. But your page stays offline until you do.</p>
    <p style="margin:0 0 14px 0;">Need help deciding or setting something up? Reply to this email and I&rsquo;ll help you personally.</p>`,
    unsubUrl);

  return { subject, text, html };
}

function emailPaymentFailed(r: Recipient, unsubUrl: string) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const businessName = r.businessName || "your business";
  const billingUrl = `${APP_URL}/dashboard/billing`;
  const subject = `We couldn't charge your card — DetailBook is paused`;

  const textBody = `Hi ${firstName},

Your trial for ${businessName} just ended and we tried to charge your card on file for the Starter plan — but the charge didn't go through. We've paused your DetailBook account for now.

No drama — your data is safe and your booking page can come back the second you fix it:

→ Update card & reactivate: ${billingUrl}

Common reasons: expired card, daily limit, or the bank blocked an "unknown merchant" charge. Reach out if you need help — reply to this email.

Ardit
Founder, DetailBook
${APP_URL}

---
Don't want these? Unsubscribe: ${unsubUrl}`;

  const e = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DetailBook</title></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;background:#fff;">
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">Your trial for <strong>${e(businessName)}</strong> just ended and we tried to charge your card on file for the Starter plan — but the charge didn&rsquo;t go through. We&rsquo;ve paused your DetailBook account for now.</p>
    <p style="margin:0 0 14px 0;">No drama — your data is safe and your booking page can come back the second you fix it:</p>
    <p style="margin:0 0 24px 0;">
      <a href="${billingUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;text-decoration:none;">Update card &amp; reactivate</a>
    </p>
    <p style="margin:0 0 14px 0;">Common reasons: expired card, daily limit, or the bank blocked an &ldquo;unknown merchant&rdquo; charge. Reach out if you need help — reply to this email.</p>
    <p style="margin:18px 0 6px 0;">Ardit<br><span style="color:#6b7280;">Founder, DetailBook</span></p>
    <p style="margin:32px 0 0 0;font-size:11px;color:#999;line-height:1.5;">
      <a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe from these emails</a>
    </p>
  </div>
</body>
</html>`;

  return { subject, text: textBody, html: htmlBody };
}

function emailPaymentIssue(r: Recipient) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const businessName = r.businessName || "your business";
  const billingUrl = `${APP_URL}/dashboard/billing`;
  const subject = `Payment failed - DetailBook is paused`;
  const e = escapeHtml;

  const text = `Hi ${firstName},

We could not process the latest DetailBook payment for ${businessName}, so the account is paused for now.

Your data is safe. Update your payment method to reactivate the booking page:
${billingUrl}

Common reasons include an expired card, a bank decline, or a payment limit. Reply to this email if you need help.

Ardit
Founder, DetailBook`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DetailBook payment issue</title></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;background:#fff;">
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">We could not process the latest DetailBook payment for <strong>${e(businessName)}</strong>, so the account is paused for now.</p>
    <p style="margin:0 0 14px 0;">Your data is safe. Update your payment method to reactivate the booking page:</p>
    <p style="margin:0 0 24px 0;"><a href="${billingUrl}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;text-decoration:none;">Update payment and reactivate</a></p>
    <p style="margin:0 0 14px 0;">Common reasons include an expired card, a bank decline, or a payment limit. Reply to this email if you need help.</p>
    <p style="margin:18px 0 6px 0;">Ardit<br><span style="color:#6b7280;">Founder, DetailBook</span></p>
    <p style="margin:32px 0 0 0;font-size:11px;color:#999;">This is an important billing notice for your DetailBook account.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

function buildEmail(key: WelcomeEmailKey, r: Recipient, unsubUrl: string) {
  switch (key) {
    case "day1": return emailDay1(r, unsubUrl);
    case "day3": return emailDay3(r, unsubUrl);
    case "day5": return emailDay5(r, unsubUrl);
    case "day7": return emailDay7(r, unsubUrl);
  }
}

export function previewWelcomeEmail(
  key: WelcomeEmailKey,
  recipient: WelcomeRecipient,
): { subject: string; text: string; html: string } {
  return buildEmail(key, recipient, `${APP_URL}/api/welcome-unsubscribe?t=preview`);
}

async function ensureUnsubToken(userId: string, current: string | null): Promise<string> {
  if (current && current.length > 0) return current;
  const token = randomBytes(24).toString("hex");
  await prisma.user.update({ where: { id: userId }, data: { welcomeUnsubToken: token } });
  return token;
}

function emailType(key: WelcomeEmailKey): string {
  return `welcome_${key}`;
}

async function logEmail(
  userId: string | null,
  key: WelcomeEmailKey,
  recipient: string,
  attempt: number,
  success: boolean,
  errorMessage: string | null,
) {
  try {
    await prisma.emailLog.create({
      data: {
        userId,
        emailType: emailType(key),
        recipient,
        success,
        errorMessage: errorMessage || null,
        attempt,
      },
    });
  } catch (err) {
    // Logging must never break the actual send flow.
    console.error("[welcome-emails] failed to write EmailLog:", err);
  }
}

// Send with up to 3 attempts (1 initial + 2 retries, exponential backoff).
// Returns the final result and writes one EmailLog row per attempt.
async function sendWithRetry(
  userId: string | null,
  key: WelcomeEmailKey,
  recipient: string,
  payload: { subject: string; text: string; html: string },
): Promise<{ success: boolean; error?: string; attempts: number }> {
  let lastError: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await sendEmail({
      to: recipient,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      replyTo: REPLY_TO,
    });

    await logEmail(userId, key, recipient, attempt, result.success, result.error || null);

    if (result.success) {
      return { success: true, attempts: attempt };
    }
    lastError = result.error || "send_failed";

    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay) await new Promise((res) => setTimeout(res, delay));
  }
  return { success: false, error: lastError, attempts: 3 };
}

// Map a key back to the legacy column it uses for storage. We reuse the
// old day0/day2/day5/day13 columns so the new sequence can ride on the
// existing User row without a migration — they're just storage now.
function timestampColumn(key: WelcomeEmailKey): "welcomeEmailDay0At" | "welcomeEmailDay2At" | "welcomeEmailDay5At" | "welcomeEmailDay13At" {
  switch (key) {
    case "day1": return "welcomeEmailDay0At";
    case "day3": return "welcomeEmailDay2At";
    case "day5": return "welcomeEmailDay5At";
    case "day7": return "welcomeEmailDay13At";
  }
}

// Counter we keep in sync for the legacy admin views.
function legacyCounterFloor(key: WelcomeEmailKey): number {
  switch (key) {
    case "day1": return 1;
    case "day3": return 2;
    case "day5": return 3;
    case "day7": return 4;
  }
}

// Send a specific welcome email. Used by:
//   - hourly cron                            (drives day1/3/5/7)
//   - admin "Resend welcome"                 (any key, forceResend=true)
//   - admin "Test sequence"                  (any key, overrideTo set)
//
// When overrideTo is set, sends to that address WITHOUT updating any
// per-user tracking columns. Logs still get written so admin testing
// is visible in the audit trail.
export async function sendWelcomeEmail(
  userId: string,
  key: WelcomeEmailKey,
  options: { overrideTo?: string; forceResend?: boolean } = {},
): Promise<{ success: boolean; error?: string; sentTo?: string; attempts?: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      businessName: true,
      slug: true,
      name: true,
      trialEndsAt: true,
      businessHours: true,
      bookingPageTitle: true,
      pageContent: true,
      bio: true,
      onboardingProgress: true,
      welcomeUnsubToken: true,
      welcomeEmailsPaused: true,
      suspended: true,
      subscriptionStatus: true,
      paddleSubscriptionId: true,
      welcomeEmailDay0At: true,
      welcomeEmailDay2At: true,
      welcomeEmailDay5At: true,
      welcomeEmailDay13At: true,
      _count: { select: { packages: true } },
    },
  });
  if (!user) return { success: false, error: "user_not_found" };

  const progress =
    user.onboardingProgress && typeof user.onboardingProgress === "object"
      ? user.onboardingProgress as Record<string, unknown>
      : {};
  const imageFlags = await prisma.$queryRaw<Array<{ hasLogo: boolean; hasBanner: boolean }>>`
    SELECT (logo IS NOT NULL AND logo <> '' AND logo NOT LIKE '/api/%') AS "hasLogo",
           ("bannerImage" IS NOT NULL AND "bannerImage" <> '' AND "bannerImage" NOT LIKE '/api/%') AS "hasBanner"
    FROM "User" WHERE id = ${user.id}`;
  const flags = imageFlags[0] ?? { hasLogo: false, hasBanner: false };
  const hasPageContent =
    user.pageContent &&
    typeof user.pageContent === "object" &&
    Object.keys(user.pageContent as Record<string, unknown>).length > 0;
  const recipientSnapshot = (): Recipient => ({
    id: user.id,
    email: user.email,
    businessName: user.businessName,
    slug: user.slug,
    name: user.name || "",
    trialEndsAt: user.trialEndsAt || "",
    packageCount: user._count.packages,
    hasWorkingHours: Boolean(progress.working_hours) || user.businessHours != null,
    hasCustomizedPage:
      Boolean(progress.customize_page) ||
      flags.hasLogo ||
      flags.hasBanner ||
      Boolean(user.bookingPageTitle?.trim()) ||
      Boolean(user.bio?.trim()) ||
      Boolean(hasPageContent),
    hasSharedLink: Boolean(progress.share_link),
  });

  const isTest = Boolean(options.overrideTo);

  // Guards — skipped for admin test sends.
  if (!isTest) {
    if (user.welcomeEmailsPaused) return { success: false, error: "paused" };
    if (user.suspended) return { success: false, error: "suspended" };
    const status = (user.subscriptionStatus || "").toLowerCase();
    if (["active", "canceled", "paused", "past_due"].includes(status)) {
      return { success: false, error: status === "active" ? "already_subscribed" : `subscription_${status}` };
    }
    // Legacy card-on-file trials carry a Paddle subscription — confirm with
    // Paddle (the source of truth) and self-heal if they've already
    // converted. Current no-card trials have no Paddle sub; their trial
    // lives entirely in our DB, so the status guard above is the check.
    if (user.paddleSubscriptionId) {
      const liveStatus = await fetchPaddleSubscriptionStatus(user.paddleSubscriptionId);
      if (liveStatus !== "trialing") {
        if (liveStatus === "active") {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: "active", trialEndsAt: "" },
            select: { id: true },
          });
        }
        return {
          success: false,
          error: liveStatus === "active" ? "already_subscribed" : liveStatus ? `subscription_${liveStatus}` : "paddle_status_unknown",
        };
      }
    } else if (!user.trialEndsAt) {
      // No Paddle sub and no trial window to anchor on — nothing to send.
      return { success: false, error: "no_trial" };
    }

    // Atomically claim this email before sending. The cron can overlap or a
    // serverless request can be retried; only one caller may change null to
    // this claim timestamp, so the recipient can never receive duplicates.
    if (!options.forceResend) {
      const col = timestampColumn(key);
      const claimAt = new Date();
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, [col]: null },
        data: { [col]: claimAt } as any,
      });
      if (claimed.count === 0) return { success: false, error: "already_sent" };

      const token = await ensureUnsubToken(user.id, user.welcomeUnsubToken);
      const unsubUrl = unsubLink(token);
      const recipient = recipientSnapshot();
      const payload = buildEmail(key, recipient, unsubUrl);
      const result = await sendWithRetry(user.id, key, user.email, payload);

      if (!result.success) {
        // Release only our own claim so a later cron tick can retry.
        await prisma.user.updateMany({
          where: { id: user.id, [col]: claimAt },
          data: { [col]: null } as any,
        });
        return { success: false, error: result.error, sentTo: user.email, attempts: result.attempts };
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          welcomeEmailLastSentAt: new Date(),
          welcomeEmailsSent: { set: legacyCounterFloor(key) },
        },
        select: { id: true },
      });
      console.log(`[welcome-emails] sent ${key} to ${user.email} (attempt ${result.attempts})`);
      return { success: true, sentTo: user.email, attempts: result.attempts };
    }
  }

  const token = await ensureUnsubToken(user.id, user.welcomeUnsubToken);
  const unsubUrl = unsubLink(token);
  const recipient = recipientSnapshot();

  const payload = buildEmail(key, recipient, unsubUrl);

  const sentTo = options.overrideTo || user.email;
  const result = await sendWithRetry(isTest ? null : user.id, key, sentTo, payload);

  if (!result.success) {
    console.error(`[welcome-emails] ${key} failed after ${result.attempts} attempts → ${sentTo}: ${result.error}`);
    return { success: false, error: result.error, sentTo, attempts: result.attempts };
  }

  // Persist per-user tracking only for real sends.
  if (!isTest) {
    const col = timestampColumn(key);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        [col]: new Date(),
        welcomeEmailLastSentAt: new Date(),
        welcomeEmailsSent: { set: legacyCounterFloor(key) },
      } as any,
      select: { id: true },
    });
    console.log(`[welcome-emails] sent ${key} to ${user.email} (attempt ${result.attempts})`);
  }

  return { success: true, sentTo, attempts: result.attempts };
}


// Decide which email key is due for a user right now, or null if none.
// Later messages are timed from the successful Day 1 send so delayed trial
// activation cannot cause several emails to bunch together.
// The app-owned trial starts at signup. Day 1 is sent as soon as the cron
// sees the user; later messages are spaced from the successful Day 1 send.
export type DueDecision =
  | { action: "send"; key: WelcomeEmailKey }
  | { action: "none"; reason: string };

export async function decideNextAction(user: {
  id: string;
  createdAt: Date;
  trialEndsAt: string;
  welcomeEmailDay0At: Date | null;
  welcomeEmailDay2At: Date | null;
  welcomeEmailDay5At: Date | null;
  welcomeEmailDay13At: Date | null;
  welcomeEmailsPaused: boolean;
  suspended: boolean;
  subscriptionStatus: string | null;
  paddleCustomerId: string | null;
}, now: Date = new Date()): Promise<DueDecision> {
  if (user.welcomeEmailsPaused) return { action: "none", reason: "paused" };
  if (user.suspended) return { action: "none", reason: "suspended" };
  // No-card trials (current model) are anchored on signup, not a card save,
  // so we no longer require a card on file. Legacy card-on-file trials flow
  // through the same steps. Status guard below excludes paid/canceled/etc.

  const status = (user.subscriptionStatus || "").toLowerCase();
  // Trial messaging is only for a genuine trial. Paying, canceled, paused,
  // and past-due customers must never receive any step of this sequence.
  if (status === "active") return { action: "none", reason: "already_subscribed" };
  if (["canceled", "paused", "past_due"].includes(status)) {
    return { action: "none", reason: `subscription_${status}` };
  }

  const trialEnds = Date.parse(user.trialEndsAt);
  if (Number.isNaN(trialEnds)) return { action: "none", reason: "invalid_trial_end" };

  const dayMs = 24 * 60 * 60 * 1000;
  const remainingMs = trialEnds - now.getTime();
  if (remainingMs <= 0) return { action: "none", reason: "trial_ended" };

  // Countdown messages are tied to the app-owned trial end. This also
  // handles extended promo trials correctly: they get the reminders two
  // days and one day before their real expiration, not on fixed signup days.
  if (user.welcomeEmailDay13At) return { action: "none", reason: "sequence_complete" };
  if (remainingMs <= dayMs) return { action: "send", key: "day7" };
  if (user.welcomeEmailDay5At) return { action: "none", reason: "not_due" };
  if (remainingMs <= 2 * dayMs) return { action: "send", key: "day5" };

  if (user.welcomeEmailDay2At) return { action: "none", reason: "not_due" };
  if (!user.welcomeEmailDay0At) return { action: "send", key: "day1" };

  const accountAgeMs = now.getTime() - user.createdAt.getTime();
  if (accountAgeMs >= 2 * dayMs) return { action: "send", key: "day3" };

  return { action: "none", reason: "not_due" };
}

// Used by the cron route. Walks the candidates and acts on each.
export async function runWelcomeSequenceTick(): Promise<{
  checked: number;
  sent: { email: string; key: WelcomeEmailKey }[];
  skipped: { email: string; reason: string }[];
}> {
  // Promo codes can extend the app-owned trial up to three months. Keep a
  // bounded scan while covering those extended trials and their final
  // countdown messages.
  const sinceCutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      createdAt: { gte: sinceCutoff },
      welcomeEmailsPaused: false,
      suspended: false,
      OR: [
        { subscriptionStatus: null },
        { subscriptionStatus: "" },
        { subscriptionStatus: "trialing" },
      ],
      // No card required — no-card trials are eligible too. Paid/canceled/
      // paused/past-due are already excluded by the status filter above.
      // At least one of the four storage columns still null means
      // there's something left to potentially send.
      AND: [
        {
          OR: [
            { welcomeEmailDay0At: null },
            { welcomeEmailDay2At: null },
            { welcomeEmailDay5At: null },
            { welcomeEmailDay13At: null },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      trialEndsAt: true,
      welcomeEmailDay0At: true,
      welcomeEmailDay2At: true,
      welcomeEmailDay5At: true,
      welcomeEmailDay13At: true,
      welcomeEmailsPaused: true,
      suspended: true,
      subscriptionStatus: true,
      paddleCustomerId: true,
      paddleSubscriptionId: true,
    },
  });

  const sent: { email: string; key: WelcomeEmailKey }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const u of candidates) {
    const decision = await decideNextAction(u);
    if (decision.action === "none") {
      skipped.push({ email: u.email, reason: decision.reason });
      continue;
    }
    // Final guard for the trial-ending email (day7): never send it to an
    // actual paying subscriber. decideNextAction already skips local status
    // "active", but that can be stale after a missed Paddle webhook — so we
    // confirm live with Paddle and self-heal before sending. "active" =
    // charged/paying (skip); "trialing"/unknown = let the reminder go.
    if (decision.key === "day7" && u.paddleSubscriptionId) {
      const liveStatus = await fetchPaddleSubscriptionStatus(u.paddleSubscriptionId);
      if (liveStatus === "active") {
        await prisma.user.update({
          where: { id: u.id },
          data: { subscriptionStatus: "active", trialEndsAt: "" },
          select: { id: true },
        });
        skipped.push({ email: u.email, reason: "active_subscriber" });
        continue;
      }
    }
    const result = await sendWelcomeEmail(u.id, decision.key);
    if (result.success) {
      sent.push({ email: u.email, key: decision.key });
    } else {
      skipped.push({ email: u.email, reason: result.error || "send_failed" });
    }
  }

  return { checked: candidates.length, sent, skipped };
}

// Notifies a user when Paddle couldn't auto-charge their card at trial
// end and the account was paused. Triggered from the Paddle webhook
// (subscription.canceled) only for AUTOMATIC cancellations — user-
// initiated cancels already get their confirmation in the billing UI,
// so we skip them at the call site by checking the prior local status.
export async function sendPaymentFailedEmail(userId: string): Promise<{ success: boolean; error?: string }> {
  const alreadySent = await prisma.emailLog.findFirst({
    where: { userId, emailType: "payment_failed", success: true },
    select: { id: true },
  });
  if (alreadySent) return { success: false, error: "already_sent" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      businessName: true,
      slug: true,
      trialEndsAt: true,
      welcomeUnsubToken: true,
      _count: { select: { packages: true } },
    },
  });
  if (!user) return { success: false, error: "user_not_found" };
  const token = await ensureUnsubToken(user.id, user.welcomeUnsubToken);
  const unsubUrl = unsubLink(token);
  const recipient: Recipient = {
    id: user.id,
    email: user.email,
    businessName: user.businessName,
    slug: user.slug,
    name: user.name || "",
    trialEndsAt: user.trialEndsAt || "",
    packageCount: user._count.packages,
    hasWorkingHours: false,
    hasCustomizedPage: false,
    hasSharedLink: false,
  };

  const payload = emailPaymentIssue(recipient);
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await sendEmail({
      to: user.email,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      replyTo: REPLY_TO,
    });

    try {
      await prisma.emailLog.create({
        data: {
          userId: user.id,
          emailType: "payment_failed",
          recipient: user.email,
          success: result.success,
          errorMessage: result.error || null,
          attempt,
        },
      });
    } catch (err) {
      console.error("[payment-failed] EmailLog write failed:", err);
    }

    if (result.success) return { success: true };
    lastError = result.error || "send_failed";
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay) await new Promise((res) => setTimeout(res, delay));
  }

  return { success: false, error: lastError };
}

// ─── Win-back (post-trial) ──────────────────────────────────────────
// After the trial lapses unpaid the booking page goes offline. These two
// emails pull the owner back to reactivate. They are NOT part of the
// day1-7 sequence — they fire AFTER the trial end and use EmailLog
// (emailType "welcome_winbackN") for idempotency, so no schema migration
// is needed. No discounts, per product direction. Timing is relative to
// the real trial end: winback1 ~2 days after, winback2 ~7 days after.
export type WinBackKey = "winback1" | "winback2";

function emailWinback1(r: Recipient, unsubUrl: string) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const business = r.businessName || "your business";
  const e = escapeHtml;
  const billing = `${APP_URL}/dashboard/billing`;
  const subject = `Your DetailBook booking page is paused`;

  const text = `Hi ${firstName},

Your free trial ended, so the booking page for ${business} is now paused — anyone who opens your link right now can't book you or pay a deposit.

Everything you set up is still saved: your packages, settings, and bookings. You can turn your page back on in under a minute:
${billing}

Plans start at $24 per month and can be canceled anytime.

If something held you back or you have questions, just reply — I read every email.${tplSignatureText(unsubUrl)}`;

  const html = tplShell(`
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">Your free trial ended, so the booking page for <strong>${e(business)}</strong> is now paused — anyone who opens your link right now can&rsquo;t book you or pay a deposit.</p>
    <p style="margin:0 0 14px 0;">Everything you set up is still saved: your packages, settings, and bookings. You can turn your page back on in under a minute.</p>
    <p style="margin:0 0 20px 0;"><a href="${billing}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Reactivate my booking page</a></p>
    <p style="margin:0 0 14px 0;">Plans start at $24 per month and can be canceled anytime.</p>
    <p style="margin:0 0 14px 0;">If something held you back or you have questions, just reply — I read every email.</p>`,
    unsubUrl);

  return { subject, text, html };
}

function emailWinback2(r: Recipient, unsubUrl: string) {
  const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
  const e = escapeHtml;
  const billing = `${APP_URL}/dashboard/billing`;
  const subject = `Still want your booking page back?`;

  const text = `Hi ${firstName},

A week ago your DetailBook trial ended and your booking page went offline. I wanted to check in once more before I stop sending these.

Your packages and settings are still saved — nothing has been lost. Whenever you're ready to take online bookings and deposits again, you can switch your page back on here:
${billing}

No pressure — your account stays right here for whenever the timing's better. And if there's anything I can help with, just reply.${tplSignatureText(unsubUrl)}`;

  const html = tplShell(`
    <p style="margin:0 0 14px 0;">Hi ${e(firstName)},</p>
    <p style="margin:0 0 14px 0;">A week ago your DetailBook trial ended and your booking page went offline. I wanted to check in once more before I stop sending these.</p>
    <p style="margin:0 0 14px 0;">Your packages and settings are still saved — nothing has been lost. Whenever you&rsquo;re ready to take online bookings and deposits again, you can switch your page back on:</p>
    <p style="margin:0 0 20px 0;"><a href="${billing}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Turn my booking page back on</a></p>
    <p style="margin:0 0 14px 0;">No pressure — your account stays right here for whenever the timing&rsquo;s better. And if there&rsquo;s anything I can help with, just reply.</p>`,
    unsubUrl);

  return { subject, text, html };
}

function buildWinBack(key: WinBackKey, r: Recipient, unsubUrl: string) {
  return key === "winback1" ? emailWinback1(r, unsubUrl) : emailWinback2(r, unsubUrl);
}

function winBackEmailType(key: WinBackKey): string {
  return `welcome_${key}`;
}

async function hasSentEmailType(userId: string, emailType: string): Promise<boolean> {
  const row = await prisma.emailLog.findFirst({
    where: { userId, emailType, success: true },
    select: { id: true },
  });
  return Boolean(row);
}

export function previewWinBackEmail(
  key: WinBackKey,
  recipient: WelcomeRecipient,
): { subject: string; text: string; html: string } {
  return buildWinBack(key, recipient, `${APP_URL}/api/welcome-unsubscribe?t=preview`);
}

// Send one win-back email. Idempotent via EmailLog: a successful prior send
// of the same type short-circuits. Skips paid/canceled/paused/past-due and
// self-heals legacy card trials that already converted at Paddle.
export async function sendWinBackEmail(
  userId: string,
  key: WinBackKey,
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      businessName: true,
      slug: true,
      trialEndsAt: true,
      welcomeUnsubToken: true,
      welcomeEmailsPaused: true,
      suspended: true,
      subscriptionStatus: true,
      paddleSubscriptionId: true,
      _count: { select: { packages: true } },
    },
  });
  if (!user) return { success: false, error: "user_not_found" };
  if (user.welcomeEmailsPaused) return { success: false, error: "paused" };
  if (user.suspended) return { success: false, error: "suspended" };

  const status = (user.subscriptionStatus || "").toLowerCase();
  if (["active", "canceled", "paused", "past_due"].includes(status)) {
    return { success: false, error: status === "active" ? "already_subscribed" : `subscription_${status}` };
  }
  // Legacy card-on-file trials: confirm with Paddle (source of truth) and
  // self-heal if they've already converted.
  if (user.paddleSubscriptionId) {
    const liveStatus = await fetchPaddleSubscriptionStatus(user.paddleSubscriptionId);
    if (liveStatus === "active") {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "active", trialEndsAt: "" },
        select: { id: true },
      });
      return { success: false, error: "already_subscribed" };
    }
  }

  const emailTypeStr = winBackEmailType(key);
  if (await hasSentEmailType(user.id, emailTypeStr)) {
    return { success: false, error: "already_sent" };
  }

  const token = await ensureUnsubToken(user.id, user.welcomeUnsubToken);
  const unsubUrl = unsubLink(token);
  const recipient: Recipient = {
    id: user.id,
    email: user.email,
    businessName: user.businessName,
    slug: user.slug,
    name: user.name || "",
    trialEndsAt: user.trialEndsAt || "",
    packageCount: user._count.packages,
    hasWorkingHours: false,
    hasCustomizedPage: false,
    hasSharedLink: false,
  };
  const payload = buildWinBack(key, recipient, unsubUrl);

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await sendEmail({
      to: user.email,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      replyTo: REPLY_TO,
    });
    try {
      await prisma.emailLog.create({
        data: {
          userId: user.id,
          emailType: emailTypeStr,
          recipient: user.email,
          success: result.success,
          errorMessage: result.error || null,
          attempt,
        },
      });
    } catch (err) {
      console.error("[win-back] EmailLog write failed:", err);
    }
    if (result.success) {
      console.log(`[win-back] sent ${key} to ${user.email} (attempt ${attempt})`);
      return { success: true };
    }
    lastError = result.error || "send_failed";
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay) await new Promise((res) => setTimeout(res, delay));
  }
  return { success: false, error: lastError };
}

// Cron walker for win-back. Scans accounts whose trial lapsed unpaid in
// the last 60 days and sends winback1 (>=2 days after end) then winback2
// (>=7 days after end). EmailLog guarantees each is sent at most once.
export async function runWinBackTick(): Promise<{
  checked: number;
  sent: { email: string; key: WinBackKey }[];
  skipped: { email: string; reason: string }[];
}> {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const sinceCutoff = new Date(now - 60 * dayMs);

  const candidates = await prisma.user.findMany({
    where: {
      createdAt: { gte: sinceCutoff },
      welcomeEmailsPaused: false,
      suspended: false,
      OR: [
        { subscriptionStatus: null },
        { subscriptionStatus: "" },
        { subscriptionStatus: "trialing" },
      ],
      NOT: { trialEndsAt: "" },
    },
    select: {
      id: true,
      email: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      paddleSubscriptionId: true,
    },
  });

  const sent: { email: string; key: WinBackKey }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const u of candidates) {
    const ends = Date.parse(u.trialEndsAt);
    if (Number.isNaN(ends)) { skipped.push({ email: u.email, reason: "invalid_trial_end" }); continue; }
    const sinceEndMs = now - ends;
    if (sinceEndMs <= 0) { skipped.push({ email: u.email, reason: "trial_active" }); continue; }
    const daysSinceEnd = sinceEndMs / dayMs;

    let key: WinBackKey | null = null;
    if (daysSinceEnd >= 7) {
      if (!(await hasSentEmailType(u.id, winBackEmailType("winback2")))) key = "winback2";
    } else if (daysSinceEnd >= 2) {
      if (!(await hasSentEmailType(u.id, winBackEmailType("winback1")))) key = "winback1";
    }
    if (!key) { skipped.push({ email: u.email, reason: "not_due" }); continue; }

    const result = await sendWinBackEmail(u.id, key);
    if (result.success) sent.push({ email: u.email, key });
    else skipped.push({ email: u.email, reason: result.error || "send_failed" });
  }

  return { checked: candidates.length, sent, skipped };
}

// Sends all four trial-sequence emails to an arbitrary address (the
// admin) without touching any user tracking. Used by the admin
// "Test sequence" button.
export async function sendTestSequence(
  userId: string,
  overrideTo: string,
): Promise<{ results: { key: WelcomeEmailKey; success: boolean; error?: string }[] }> {
  const keys: WelcomeEmailKey[] = ["day1", "day3", "day5", "day7"];
  const results: { key: WelcomeEmailKey; success: boolean; error?: string }[] = [];
  for (const key of keys) {
    const r = await sendWelcomeEmail(userId, key, { overrideTo });
    results.push({ key, success: r.success, error: r.error });
  }
  return { results };
}
