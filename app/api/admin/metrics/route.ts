import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

// Activation/engagement metrics for the founder admin dashboard.
//
//   GET /api/admin/metrics?from=ISO&to=ISO
//
// `from` and `to` are inclusive ISO timestamps that bound the user
// cohort by createdAt. Both are optional — omitting them means
// all-time. The endpoint also computes counts for the equivalent
// previous period (same length, ending right before `from`) so the
// UI can show "+X vs previous period" deltas.
//
// Funnel rows are computed off the same cohort so dropping the date
// range to "Since Ads Started" automatically excludes test signups
// from before the campaign.
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    // Defaults: from = epoch, to = now. parseDate(null) returns null
    // which we coerce to the default below.
    const parseDate = (s: string | null): Date | null => {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };
    const now = new Date();
    const from = parseDate(fromParam) || new Date(0);
    const to = parseDate(toParam) || now;
    if (from.getTime() > to.getTime()) {
      return NextResponse.json({ error: "'from' must be before 'to'" }, { status: 400 });
    }

    // Equivalent previous period — same length, ending right before `from`.
    const rangeMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - rangeMs);

    // Single query for the cohort. We pull only the fields the metrics
    // logic needs to keep the response light even for thousands of users.
    const cohort = await prisma.user.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        id: true,
        createdAt: true,
        lastLoginAt: true,
        trialEndsAt: true,
        subscriptionStatus: true,
        plan: true,
        onboardingProgress: true,
        _count: { select: { packages: true, bookings: true } },
      },
    });

    const totalSignups = cohort.length;

    // Previous-period signup count — we don't need full rows, just the count.
    const prevTotalSignups = await prisma.user.count({
      where: { createdAt: { gte: prevFrom, lte: prevTo } },
    });

    // "Signups This Week" is fixed at the last 7 calendar days, ignoring
    // the selected range — it's a "recent activity" gauge, not a cohort
    // metric. Compared against the 7 days before that.
    const week1Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const week2Start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const [signupsLast7, signupsPrev7] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: week1Start, lte: now } } }),
      prisma.user.count({ where: { createdAt: { gte: week2Start, lt: week1Start } } }),
    ]);

    // Per-user booleans driven from the cohort rows.
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const isPaying = (s: string | null) => {
      const v = (s || "").toLowerCase();
      return v === "active" || v === "past_due";
    };
    let activatedUsers = 0;          // 1+ packages
    let sharedLinkUsers = 0;         // share_link onboarding flag set
    let bookedUsers = 0;             // 1+ bookings
    let payingTotal = 0;
    let payingStarter = 0;
    let payingPro = 0;
    let activeUsers7d = 0;           // logged in within last 7 days
    let dropoffUsers = 0;            // signed up, never came back
    let trialsEnded = 0;             // trial in the past, didn't subscribe
    let payingFromCohort = 0;        // subscribers within the cohort

    for (const u of cohort) {
      const hasPackages = u._count.packages > 0;
      const hasBookings = u._count.bookings > 0;
      const paying = isPaying(u.subscriptionStatus);

      if (hasPackages) activatedUsers += 1;
      if (hasBookings) bookedUsers += 1;
      if (paying) {
        payingTotal += 1;
        payingFromCohort += 1;
        if (u.plan === "pro") payingPro += 1;
        else payingStarter += 1;
      }

      // share_link flag from the Json onboardingProgress column. Falsy
      // values (null, undefined, missing) all count as "not shared".
      const progress = (u.onboardingProgress as { share_link?: boolean } | null) || null;
      if (progress?.share_link === true) sharedLinkUsers += 1;

      if (u.lastLoginAt && u.lastLoginAt.getTime() >= sevenDaysAgo.getTime()) {
        activeUsers7d += 1;
      }

      // Drop-off: signed up but no follow-up activity. We define it as
      // (a) never logged in again after signup-time, AND (b) no packages
      // created. Mirrors the user-friendly "abandoned after signup" copy.
      // lastLoginAt is updated at most every 5 min by /api/auth/me, so
      // we treat "within 24h of signup" as the signup login itself.
      const signupTs = u.createdAt.getTime();
      const lastLoginTs = u.lastLoginAt?.getTime();
      const onlyLoggedInAtSignup =
        !lastLoginTs || (lastLoginTs - signupTs) <= 24 * 60 * 60 * 1000;
      if (onlyLoggedInAtSignup && !hasPackages) dropoffUsers += 1;

      // trialEndsAt is stored as a string. Empty strings mean "never set".
      if (u.trialEndsAt) {
        const t = new Date(u.trialEndsAt);
        if (!isNaN(t.getTime()) && t.getTime() < now.getTime()) {
          trialsEnded += 1;
        }
      }
    }

    const pct = (num: number, denom: number) =>
      denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0; // 1 decimal place

    const activationRate = pct(activatedUsers, totalSignups);
    const dropoffRate = pct(dropoffUsers, totalSignups);
    // Conversion: paying-subscribers-in-cohort / trials-ended-in-cohort.
    // If nobody's trial has run out yet inside the selected range, the
    // ratio is meaningless — the UI will show "Not enough data".
    const trialToPaidRate = trialsEnded > 0 ? pct(payingFromCohort, trialsEnded) : null;

    return NextResponse.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        days: Math.max(1, Math.round(rangeMs / (24 * 60 * 60 * 1000))),
      },
      current: {
        totalSignups,
        signupsLast7,
        activationRate,
        activatedUsers,
        activeUsers7d,
        dropoffRate,
        dropoffUsers,
        paying: { total: payingTotal, starter: payingStarter, pro: payingPro },
        trialToPaidRate,
        trialsEnded,
        funnel: {
          signups: totalSignups,
          createdPackage: activatedUsers,
          sharedLink: sharedLinkUsers,
          gotFirstBooking: bookedUsers,
          paidSubscriber: payingFromCohort,
        },
      },
      previous: {
        totalSignups: prevTotalSignups,
        signupsLast7: signupsPrev7,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/metrics error:", err);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
