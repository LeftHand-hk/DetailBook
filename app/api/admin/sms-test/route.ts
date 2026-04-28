import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { sendSms } from "@/lib/twilio";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const message = typeof body?.message === "string" && body.message.trim()
      ? body.message.trim()
      : "DetailBook test SMS — if you got this, Twilio is working.";

    if (!to) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const result = await sendSms(to, message);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "SMS failed", success: false }, { status: 502 });
    }

    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error) {
    console.error("POST /api/admin/sms-test error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
