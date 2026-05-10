import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { sendWelcomeEmail, type WelcomeEmailKey } from "@/lib/welcome-emails";

// Admin "Resend welcome" button. Forces a re-send of the chosen welcome
// email to the user's real address even if the column for that key is
// already set (i.e. the user already received it). Updates tracking so
// the audit log reflects the new send timestamp.
//
// POST { key: "day0" | "day2" | "day5" | "day13" }
const VALID_KEYS: WelcomeEmailKey[] = ["day0", "day2", "day5", "day13"];

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
        { error: "key must be day0, day2, day5, or day13" },
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
