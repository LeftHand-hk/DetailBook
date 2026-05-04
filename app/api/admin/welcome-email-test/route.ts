import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail, type WelcomeEmailNumber } from "@/lib/welcome-emails";

// Admin-only test endpoint. Sends any of the 3 welcome emails to an
// arbitrary address WITHOUT touching the recipient's tracking. Picks
// the first user in the DB as a stand-in for variable substitution
// (subject says "Welcome to DetailBook, {{businessName}}") so the
// admin sees the email exactly as a real signup would.
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const numRaw = Number(body?.num);
    const num: WelcomeEmailNumber | null =
      numRaw === 1 || numRaw === 2 || numRaw === 3 ? (numRaw as WelcomeEmailNumber) : null;

    if (!to) {
      return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
    }
    if (!num) {
      return NextResponse.json({ error: "num must be 1, 2, or 3" }, { status: 400 });
    }

    // Use the most recent real user as the variable-substitution source
    // so the test email reads with realistic copy.
    const sample = await prisma.user.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!sample) {
      return NextResponse.json({ error: "No users in DB to use as template source" }, { status: 400 });
    }

    const result = await sendWelcomeEmail(sample.id, num, { overrideTo: to });
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
