import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { sendSms, normalizePhone, isTwilioConfigured } from "@/lib/twilio";

export const dynamic = "force-dynamic";

// POST /api/admin/sms/send  { to: "+1555…", body: "…" }
// Sends an outbound SMS via Twilio and records it in the inbox so the
// thread stays in sync. Used by the reply box on /admin/sms.
export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { error: "Twilio is not configured on the server." },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { to?: string; body?: string };
    const to = normalizePhone(body.to || "");
    const text = (body.body || "").trim();

    if (!to) return NextResponse.json({ error: "A valid recipient number is required." }, { status: 400 });
    if (!text) return NextResponse.json({ error: "Message body is required." }, { status: 400 });
    if (text.length > 1600) return NextResponse.json({ error: "Message is too long (max 1600 chars)." }, { status: 400 });

    const result = await sendSms(to, text);

    // Record the outbound message regardless of send outcome so the
    // admin sees what they tried to send; status reflects success.
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || "";
    const message = await prisma.smsMessage.create({
      data: {
        direction: "outbound",
        contact: to, // the customer's number
        fromNumber,
        toNumber: to,
        body: text,
        twilioSid: result.sid || null,
        status: result.success ? "sent" : "failed",
        read: true,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "SMS failed to send.", message },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error("POST /api/admin/sms/send error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
