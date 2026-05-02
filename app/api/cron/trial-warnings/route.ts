import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Daily cron — called once per 24h by cron-job.org.
// Sends a "your trial ends in 3 days" email to users in the precise
// 24h window (2d < remaining ≤ 3d). Daily cadence + 24h window means
// each user is hit exactly once during their trial. No DB flag needed.
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const lower = now + 2 * 24 * 60 * 60 * 1000;
  const upper = now + 3 * 24 * 60 * 60 * 1000;

  try {
    // trialEndsAt is stored as ISO string — pull active-trial candidates
    // and filter in JS (window math on string fields is awkward in Prisma).
    const candidates = await prisma.user.findMany({
      where: {
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
        name: true,
        businessName: true,
        trialEndsAt: true,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://detailbookapp.com";
    const sent: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const u of candidates) {
      const ends = Date.parse(u.trialEndsAt);
      if (Number.isNaN(ends)) {
        skipped.push({ id: u.id, reason: "invalid_trialEndsAt" });
        continue;
      }
      if (ends <= lower || ends > upper) {
        // Outside the 3-day window — either too far, or already past.
        continue;
      }

      const result = await sendEmail({
        to: u.email,
        subject: "Your DetailBook trial ends in 3 days",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;color:#111">
            <h1 style="color:#dc2626;font-size:22px;margin:0 0 12px">Your free trial ends in 3 days</h1>
            <p style="color:#374151;line-height:1.55">Hi ${u.name || u.businessName},</p>
            <p style="color:#374151;line-height:1.55">
              Your DetailBook free trial for <strong>${u.businessName}</strong> ends in 3 days.
              When it does, your public booking page will be disabled and customers won't be able to book until you subscribe.
            </p>
            <p style="margin:24px 0">
              <a href="${baseUrl}/dashboard/billing" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">
                Subscribe now →
              </a>
            </p>
            <p style="color:#6b7280;font-size:13px;line-height:1.55">
              Plans start at $29/mo. Your data is preserved either way — you can resubscribe at any time.
            </p>
            <p style="color:#9ca3af;font-size:12px;margin-top:32px">— The DetailBook team</p>
          </div>
        `,
        text: `Your DetailBook free trial for ${u.businessName} ends in 3 days.\n\nWhen it does, your public booking page will be disabled and customers won't be able to book until you subscribe.\n\nSubscribe: ${baseUrl}/dashboard/billing\n\nPlans start at $29/mo. Your data is preserved either way.\n\n— The DetailBook team`,
      });

      if (result.success) {
        sent.push(u.email);
      } else {
        skipped.push({ id: u.id, reason: result.error || "send_failed" });
      }
    }

    return NextResponse.json({
      checked: candidates.length,
      sent: sent.length,
      sentTo: sent,
      skipped,
    });
  } catch (err) {
    console.error("[cron/trial-warnings] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
