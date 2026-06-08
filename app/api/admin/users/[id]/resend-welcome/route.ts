import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { sendWelcomeEmail, type WelcomeEmailKey } from "@/lib/welcome-emails";

// Admin "Resend welcome" button. Forces a re-send of the chosen welcome
// email to the user's real address even if the column for that key is
// already set (i.e. the user already received it). Updates tracking so
// the audit log reflects the new send timestamp.
//
// POST { key: "day1" | "day3" | "day5" | "day7" }
const VALID_KEYS: WelcomeEmailKey[] = ["day1", "day3", "day5", "day7"];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const keyRaw = typeof body?.key === "string" ? body.key : "day0";
    const key: WelcomeEmailKey | null = VALID_KEYS.includes(keyRaw as WelcomeEmailKey)
      ? (keyRaw as WelcomeEmailKey)
      : null;
    if (!key) {
      return NextResponse.json(
        { error: "key must be one of day1, day3, day5, day7" },
        { status: 400 },
      );
    }

    const result = await sendWelcomeEmail(params.id, key, { forceResend: true });
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "send_failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, sentTo: result.sentTo, attempts: result.attempts });
  } catch (err) {
    console.error("POST /api/admin/users/[id]/resend-welcome error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
