import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

// Twilio message-status callback. Twilio POSTs here as an outbound
// message moves through its lifecycle: queued → sent → delivered, or
// → undelivered / failed. We update the matching SmsMessage so the
// admin SMS inbox shows the REAL delivery outcome instead of a
// permanent "sent". The ErrorCode (when present) is the definitive
// reason a message didn't arrive — e.g. 21408 (geo permission not
// enabled) or 21608 (unverified number on a trial account).
export const dynamic = "force-dynamic";

function isValidTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true;
  if (!signature) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const form = new URLSearchParams(raw);
    const params: Record<string, string> = {};
    form.forEach((v, k) => { params[k] = v; });

    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const url = `${proto}://${host}/api/twilio/status`;
    const signature = req.headers.get("x-twilio-signature");

    if (!isValidTwilioSignature(url, params, signature)) {
      console.warn("[twilio/status] signature validation failed");
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const sid = params.MessageSid || params.SmsSid || "";
    const status = params.MessageStatus || params.SmsStatus || "";
    const errorCode = params.ErrorCode || "";

    if (sid) {
      // status is e.g. delivered / undelivered / failed; append the
      // Twilio error code when delivery failed so the admin can look
      // it up. timingSafe — we match on the SID we stored at send time.
      const statusWithError = errorCode ? `${status} (err ${errorCode})` : status;
      const result = await prisma.smsMessage.updateMany({
        where: { twilioSid: sid },
        data: { status: statusWithError },
      });
      console.log("[twilio/status]", sid, "→", statusWithError, `(${result.count} row)`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[twilio/status] error:", err);
    return NextResponse.json({ ok: true }); // 200 so Twilio doesn't retry-storm
  }
}
