import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    // Send to support/admin email
    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#2563EB;color:white;padding:24px;border-radius:8px 8px 0 0;">
          <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">DetailBook</div>
          <h1 style="margin:8px 0 0;font-size:22px;">New Contact Form Message</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">
            <table style="width:100%;font-size:14px;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#6b7280;width:30%;">Name</td><td style="padding:6px 0;font-weight:600;color:#111827;">${name}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;font-weight:600;color:#111827;">${email}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Subject</td><td style="padding:6px 0;font-weight:600;color:#111827;">${subject || "General"}</td></tr>
            </table>
          </div>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
            <p style="font-size:12px;color:#6b7280;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
            <p style="font-size:14px;color:#111827;white-space:pre-wrap;margin:0;">${message}</p>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin-top:16px;">Reply directly to this email to respond to ${name}.</p>
        </div>
      </div>`;

    await sendEmail({
      to: "info@detailbookapp.com",
      subject: `Contact Form: ${subject || "General"} — ${name}`,
      html,
      replyTo: email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/contact error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
