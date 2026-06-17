import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const EMAIL_TYPE = "trial_ending_24h";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Daily cron called by cron-job.org. Sends one reminder when an unpaid
// trial has between 0 and 24 hours remaining.
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const upper = now + 24 * 60 * 60 * 1000;

  try {
    const candidates = await prisma.user.findMany({
      where: {
        suspended: false,
        welcomeEmailsPaused: false,
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
        name: true,
        businessName: true,
        trialEndsAt: true,
        welcomeUnsubToken: true,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://detailbookapp.com";
    const sent: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const user of candidates) {
      const ends = Date.parse(user.trialEndsAt);
      if (Number.isNaN(ends)) {
        skipped.push({ id: user.id, reason: "invalid_trialEndsAt" });
        continue;
      }
      if (ends <= now || ends > upper) continue;

      const alreadySent = await prisma.emailLog.findFirst({
        where: { userId: user.id, emailType: EMAIL_TYPE, success: true },
        select: { id: true },
      });
      if (alreadySent) {
        skipped.push({ id: user.id, reason: "already_sent" });
        continue;
      }

      const unsubToken =
        user.welcomeUnsubToken || randomBytes(24).toString("hex");
      if (!user.welcomeUnsubToken) {
        await prisma.user.update({
          where: { id: user.id },
          data: { welcomeUnsubToken: unsubToken },
          select: { id: true },
        });
      }

      const billingUrl = `${baseUrl}/dashboard/billing`;
      const unsubUrl = `${baseUrl}/api/welcome-unsubscribe?t=${unsubToken}`;
      const greeting = escapeHtml(user.name || user.businessName || "there");
      const businessName = escapeHtml(user.businessName);

      const result = await sendEmail({
        to: user.email,
        subject: "Your DetailBook trial ends tomorrow",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;color:#111">
            <h1 style="color:#dc2626;font-size:22px;margin:0 0 12px">Your free trial ends tomorrow</h1>
            <p style="color:#374151;line-height:1.55">Hi ${greeting},</p>
            <p style="color:#374151;line-height:1.55">
              Your DetailBook trial for <strong>${businessName}</strong> ends tomorrow.
              To keep your booking page live and accepting bookings, subscribe from $24/mo.
            </p>
            <p style="color:#374151;line-height:1.55">
              If you do not subscribe, your booking page will be paused, but nothing is deleted.
              Your packages, bookings, and settings stay saved, and you can reactivate anytime.
            </p>
            <p style="margin:24px 0">
              <a href="${billingUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">
                Choose a plan
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px;line-height:1.55">
              Plans start at $24/mo. Cancel anytime.
            </p>
            <p style="color:#9ca3af;font-size:12px;margin-top:32px">The DetailBook team</p>
            <p style="color:#9ca3af;font-size:11px;margin-top:24px">
              <a href="${unsubUrl}" style="color:#9ca3af">Unsubscribe from onboarding emails</a>
            </p>
          </div>
        `,
        text: `Your DetailBook trial for ${user.businessName} ends tomorrow.

To keep your booking page live and accepting bookings, subscribe from $24/mo:
${billingUrl}

If you do not subscribe, your booking page will be paused, but nothing is deleted. Your packages, bookings, and settings stay saved, and you can reactivate anytime.

Plans start at $24/mo. Cancel anytime.

The DetailBook team

Unsubscribe from onboarding emails: ${unsubUrl}`,
      });

      await prisma.emailLog
        .create({
          data: {
            userId: user.id,
            emailType: EMAIL_TYPE,
            recipient: user.email,
            success: result.success,
            errorMessage: result.error || null,
            attempt: 1,
          },
        })
        .catch((error) => {
          console.error("[cron/trial-warnings] EmailLog write failed:", error);
        });

      if (result.success) {
        sent.push(user.email);
      } else {
        skipped.push({ id: user.id, reason: result.error || "send_failed" });
      }
    }

    return NextResponse.json({
      checked: candidates.length,
      sent: sent.length,
      sentTo: sent,
      skipped,
    });
  } catch (error) {
    console.error("[cron/trial-warnings] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
