import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

// Inbound SMS webhook. Configure this URL as the "A MESSAGE COMES IN"
// webhook on your Twilio number (or Messaging Service):
//   https://detailbookapp.com/api/twilio/inbound   (HTTP POST)
//
// Twilio sends application/x-www-form-urlencoded with From, To, Body,
// MessageSid, etc. We persist the message so it shows up in the admin
// SMS inbox (/admin/sms) and reply with empty TwiML (we send replies
// from the dashboard via the REST API, not inline here).
export const dynamic = "force-dynamic";

// Validates Twilio's X-Twilio-Signature header. Twilio signs the full
// request URL + sorted POST params with your auth token (HMAC-SHA1).
// Skipped only when the auth token isn't set (local dev). See:
// https://www.twilio.com/docs/usage/security#validating-requests
function isValidTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // not configured — allow in dev
  if (!signature) return false;

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const form = new URLSearchParams(raw);
    const params: Record<string, string> = {};
    form.forEach((v, k) => { params[k] = v; });

    // Reconstruct the public URL Twilio signed. Prefer forwarded host
    // headers (Netlify/Proxy) so the signature base matches what
    // Twilio used.
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const url = `${proto}://${host}/api/twilio/inbound`;
    const signature = req.headers.get("x-twilio-signature");

    if (!isValidTwilioSignature(url, params, signature)) {
      console.warn("[twilio/inbound] signature validation failed");
      return new NextResponse(EMPTY_TWIML, {
        status: 403,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const from = params.From || "";
    const to = params.To || "";
    const body = params.Body || "";
    const sid = params.MessageSid || params.SmsSid || null;

    if (from && body) {
      await prisma.smsMessage.create({
        data: {
          direction: "inbound",
          contact: from, // the customer's number
          fromNumber: from,
          toNumber: to,
          body,
          twilioSid: sid,
          status: "received",
          read: false,
        },
      });
      console.log("[twilio/inbound] stored inbound SMS from", from);
    }

    // Reply with empty TwiML — no auto-reply. Admin answers from the
    // dashboard.
    return new NextResponse(EMPTY_TWIML, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio/inbound] error:", err);
    // Still return 200 empty TwiML so Twilio doesn't retry-storm us.
    return new NextResponse(EMPTY_TWIML, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
