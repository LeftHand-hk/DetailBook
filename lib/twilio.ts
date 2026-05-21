// Normalise a phone number to E.164. We only assume the US country
// code (+1) for the clear US/Canada shapes — a 10-digit number, or an
// 11-digit number starting with 1. Anything else is treated as a full
// international number the caller typed without the leading "+", so we
// just prefix it. This stops a Kosovo number like 38348394457 from
// being mangled into +138348394457.
export function normalizePhone(raw: string): string {
  const trimmed = (raw || "").trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;            // US/Canada, no country code
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`; // US/Canada with 1
  return `+${digits}`;                                        // assume full intl number
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER)
  );
}

export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string; sid?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    console.warn("SMS not sent — Twilio not configured");
    return { success: false, error: "Twilio not configured" };
  }

  // Normalize phone number to E.164 (shared helper handles US vs intl).
  const normalized = normalizePhone(to);

  // Prefer MessagingServiceSid (handles routing, compliance, sender pool).
  // Fall back to From number if no service is configured.
  const params: Record<string, string> = { To: normalized, Body: body };
  if (messagingServiceSid) params.MessagingServiceSid = messagingServiceSid;
  else if (from) params.From = from;

  // Ask Twilio to POST delivery-status updates back to us. The initial
  // API response only tells us Twilio ACCEPTED the message (status
  // "queued"/"accepted") — actual delivery success/failure (e.g. a
  // geo-permission block or an unverified trial number) arrives
  // asynchronously here. Without this, a message that Twilio later
  // fails to deliver looks "sent" forever in our UI. Requires a public
  // app URL; skipped silently in local dev where there's no callback host.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl.startsWith("http")) {
    params.StatusCallback = `${appUrl.replace(/\/$/, "")}/api/twilio/status`;
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Twilio error:", data);
      return { success: false, error: data?.message || "SMS failed" };
    }

    return { success: true, sid: data?.sid };
  } catch (err: any) {
    console.error("SMS send failed:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}
