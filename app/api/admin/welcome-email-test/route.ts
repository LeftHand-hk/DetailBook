import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  sendWelcomeEmail,
  sendTestSequence,
  type WelcomeEmailKey,
} from "@/lib/welcome-emails";

// Admin-only test endpoint. Two modes:
//
//   POST { to, key }      — send a single welcome email (key="day0" |
//                           "day2" | "day5" | "day13") to an arbitrary
//                           address. No user tracking is touched.
//   POST { to, all: true } — send all four emails in sequence to the
//                           address. Same no-tracking guarantee.
//
// Picks the most recent real user as the variable-substitution source
// so the test email reads with realistic copy (the welcome subject is
// "Welcome to DetailBook, <businessName>" — it needs a real business
// name to look right).
const VALID_KEYS: WelcomeEmailKey[] = ["day0", "day2", "day5", "day13"];

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const all = body?.all === true;
    const keyRaw = typeof body?.key === "string" ? body.key : "";
    const key: WelcomeEmailKey | null = VALID_KEYS.includes(keyRaw as WelcomeEmailKey)
      ? (keyRaw as WelcomeEmailKey)
      : null;

    if (!to) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }
    if (!all && !key) {
      return NextResponse.json(
        { error: "Provide either { key: day0|day2|day5|day13 } or { all: true }" },
        { status: 400 },
      );
    }

    const sample = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!sample) {
      return NextResponse.json(
        { error: "No users in DB to use as template source" },
        { status: 400 },
      );
    }

    if (all) {
      const out = await sendTestSequence(sample.id, to);
      const anyFailed = out.results.some((r) => !r.success);
      return NextResponse.json(
        { success: !anyFailed, sentTo: to, results: out.results },
        { status: anyFailed ? 502 : 200 },
      );
    }

    const result = await sendWelcomeEmail(sample.id, key!, { overrideTo: to });
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "send_failed", success: false },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, sentTo: result.sentTo });
  } catch (err) {
    console.error("POST /api/admin/welcome-email-test error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
