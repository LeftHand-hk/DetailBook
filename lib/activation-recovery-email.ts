import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://detailbookapp.com";
const FROM_ADDRESS = process.env.SMTP_FROM || "info@detailbookapp.com";
const RETRY_DELAYS_MS = [1000, 4000];

function hasCompletedBusinessDetails(user: {
  phone: string;
  address: string | null;
  serviceAreas: unknown;
}): boolean {
  const firstArea =
    Array.isArray(user.serviceAreas) && user.serviceAreas[0]
      ? String(user.serviceAreas[0]).trim()
      : "";
  return Boolean(user.phone.trim() || user.address?.trim() || firstArea);
}

async function ensureUnsubToken(userId: string, current: string | null): Promise<string> {
  if (current) return current;
  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { welcomeUnsubToken: token },
    select: { id: true },
  });
  return token;
}

async function logAttempt(
  userId: string,
  recipient: string,
  attempt: number,
  success: boolean,
  errorMessage?: string,
) {
  try {
    await prisma.emailLog.create({
      data: {
        userId,
        emailType: "activation_recovery",
        recipient,
        attempt,
        success,
        errorMessage: errorMessage || null,
      },
    });
  } catch (err) {
    console.error("[activation-recovery] failed to write EmailLog:", err);
  }
}

export async function runActivationRecoveryTick(): Promise<{
  checked: number;
  sent: string[];
  skipped: { email: string; reason: string }[];
}> {
  const now = new Date();
  const dueBefore = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const recentAfter = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.$queryRaw<Array<{
    id: string;
    email: string;
    name: string;
    businessName: string;
    phone: string;
    address: string | null;
    serviceAreas: unknown;
    welcomeUnsubToken: string | null;
  }>>`
    SELECT id, email, name, "businessName", phone, address, "serviceAreas", "welcomeUnsubToken"
    FROM "User"
    WHERE "createdAt" >= ${recentAfter}
      AND "createdAt" <= ${dueBefore}
      AND suspended = false
      AND "welcomeEmailsPaused" = false
      AND "activationRecoveryEmailAt" IS NULL
      AND "paddleCustomerId" IS NULL
      AND "paddleSubscriptionId" IS NULL
      AND ("subscriptionStatus" IS NULL OR "subscriptionStatus" = '')
      AND NOT EXISTS (
        SELECT 1 FROM "Package" p WHERE p."userId" = "User".id
      )
  `;

  const sent: string[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const user of candidates) {
    if (!hasCompletedBusinessDetails(user)) {
      skipped.push({ email: user.email, reason: "business_details_not_completed" });
      continue;
    }

    const token = await ensureUnsubToken(user.id, user.welcomeUnsubToken);
    const claimAt = new Date();
    const claimed = await prisma.$executeRaw`
      UPDATE "User"
      SET "activationRecoveryEmailAt" = ${claimAt}
      WHERE id = ${user.id}
        AND "activationRecoveryEmailAt" IS NULL
        AND "paddleCustomerId" IS NULL
        AND "paddleSubscriptionId" IS NULL
        AND "welcomeEmailsPaused" = false
        AND suspended = false
        AND NOT EXISTS (
          SELECT 1 FROM "Package" p WHERE p."userId" = "User".id
        )
    `;
    if (claimed === 0) {
      skipped.push({ email: user.email, reason: "no_longer_eligible" });
      continue;
    }

    let latest;
    try {
      latest = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          paddleCustomerId: true,
          paddleSubscriptionId: true,
          subscriptionStatus: true,
          welcomeEmailsPaused: true,
          suspended: true,
          _count: { select: { packages: true } },
        },
      });
    } catch (err) {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "activationRecoveryEmailAt" = NULL
        WHERE id = ${user.id} AND "activationRecoveryEmailAt" = ${claimAt}
      `;
      console.error("[activation-recovery] eligibility recheck failed:", err);
      skipped.push({ email: user.email, reason: "eligibility_recheck_failed" });
      continue;
    }
    if (
      !latest ||
      latest.paddleCustomerId ||
      latest.paddleSubscriptionId ||
      latest.welcomeEmailsPaused ||
      latest.suspended ||
      latest._count.packages > 0 ||
      (latest.subscriptionStatus && latest.subscriptionStatus !== "")
    ) {
      skipped.push({ email: user.email, reason: "no_longer_eligible" });
      continue;
    }

    const firstName = user.name.trim().split(/\s+/)[0] || "there";
    const onboardingUrl = `${APP_URL}/onboarding`;
    const unsubUrl = `${APP_URL}/api/welcome-unsubscribe?t=${token}`;
    const subject = "Your DetailBook setup is almost finished";
    const text = `Hi ${firstName},

You created your DetailBook account, but your booking page setup is not finished yet.

Your 7-day trial is already running. Finish adding your first service package so customers can start booking with you.

Continue setup: ${onboardingUrl}

If you have any questions, reply to this email and I'll help you personally.

Ardit
DetailBook

---
Don't want these emails? Unsubscribe: ${unsubUrl}`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Finish setting up DetailBook</title></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#111;">
    <p>Hi ${firstName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")},</p>
    <p>You created your DetailBook account, but your booking page setup is not finished yet.</p>
    <p>Your 7-day trial is already running. Finish adding your first service package so customers can start booking with you.</p>
    <p style="margin:24px 0;"><a href="${onboardingUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 22px;border-radius:9px;text-decoration:none;font-weight:700;">Finish setting up DetailBook</a></p>
    <p>If you have any questions, reply to this email and I&rsquo;ll help you personally.</p>
    <p>Ardit<br><span style="color:#6b7280;">DetailBook</span></p>
    <p style="margin-top:32px;font-size:11px;color:#999;"><a href="${unsubUrl}" style="color:#999;">Unsubscribe from these emails</a></p>
  </div>
</body></html>`;

    let lastError: string | undefined;
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await sendEmail({
        to: user.email,
        subject,
        text,
        html,
        from: `"Ardit from DetailBook" <${FROM_ADDRESS}>`,
        replyTo: "info@detailbookapp.com",
      });
      await logAttempt(user.id, user.email, attempt, result.success, result.error);
      if (result.success) {
        success = true;
        break;
      }
      lastError = result.error || "send_failed";
      const delay = RETRY_DELAYS_MS[attempt - 1];
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (success) {
      sent.push(user.email);
    } else {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "activationRecoveryEmailAt" = NULL
        WHERE id = ${user.id} AND "activationRecoveryEmailAt" = ${claimAt}
      `;
      skipped.push({ email: user.email, reason: lastError || "send_failed" });
    }
  }

  return { checked: candidates.length, sent, skipped };
}
