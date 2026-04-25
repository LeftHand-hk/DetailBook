export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string; sid?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || (!messagingServiceSid && !from)) {
    console.warn("SMS not sent — Twilio not configured");
    return { success: false, error: "Twilio not configured" };
  }

  // Normalize phone number: must start with +
  const normalized = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;

  // Prefer MessagingServiceSid (handles routing, compliance, sender pool).
  // Fall back to From number if no service is configured.
  const params: Record<string, string> = { To: normalized, Body: body };
  if (messagingServiceSid) params.MessagingServiceSid = messagingServiceSid;
  else if (from) params.From = from;

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
