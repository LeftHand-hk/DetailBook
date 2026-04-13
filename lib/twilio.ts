export async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.warn("SMS not sent — Twilio not configured");
    return { success: false, error: "Twilio not configured" };
  }

  // Normalize phone number: must start with +
  const normalized = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: normalized, Body: body }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Twilio error:", data);
      return { success: false, error: data?.message || "SMS failed" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("SMS send failed:", err);
    return { success: false, error: err?.message || "Unknown error" };
  }
}
