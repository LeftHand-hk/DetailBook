import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

// DEV-ONLY test endpoint — remove before launch or restrict to admin
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { to, type } = await request.json();

  if (!to) {
    return NextResponse.json({ error: "Missing 'to' email address" }, { status: 400 });
  }

  const formattedDate = "Monday, April 14, 2026";
  const time = "10:00 AM";
  const serviceName = "Full Detail";
  const customerName = "Test Customer";
  const businessName = "Test Auto Detailing";

  if (type === "customer") {
    const result = await sendEmail({
      to,
      subject: `Booking Confirmed – ${serviceName} on ${formattedDate}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2563EB;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">${businessName}</div>
            <h1 style="margin:8px 0 0;font-size:22px;">Booking Confirmed!</h1>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="font-size:14px;color:#374151;">Hi ${customerName}, your booking has been received. Here are your details:</p>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:40%;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;">${serviceName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;">${time}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Vehicle</td><td style="padding:6px 0;font-weight:600;color:#111827;">2022 Toyota Camry (Black)</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;">$150</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;color:#111827;">123 Main St, Test City</td></tr>
              </table>
            </div>
            <p style="font-size:14px;color:#374151;">A deposit of <strong>$30</strong> is due at the time of service.</p>
            <p style="font-size:13px;color:#6b7280;">Questions? Contact us at <strong>(555) 123-4567</strong></p>
            <p style="font-size:13px;color:#6b7280;">— ${businessName}</p>
          </div>
        </div>`,
      text: `Booking Confirmed!\n\nHi ${customerName},\n\nService: ${serviceName}\nDate: ${formattedDate}\nTime: ${time}\nVehicle: 2022 Toyota Camry (Black)\nPrice: $150\nAddress: 123 Main St\nDeposit due: $30\n\n— ${businessName}`,
    });
    return NextResponse.json({ type: "customer", ...result });
  }

  if (type === "owner") {
    const result = await sendEmail({
      to,
      subject: `New Booking: ${customerName} – ${serviceName} on ${formattedDate}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2563EB;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">DetailBook</div>
            <h1 style="margin:8px 0 0;font-size:22px;">New Booking!</h1>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="font-size:14px;color:#374151;">You have a new booking from <strong>${customerName}</strong>.</p>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:40%;">Customer</td><td style="padding:6px 0;font-weight:600;color:#111827;">${customerName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;font-weight:600;color:#111827;">(555) 987-6543</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;font-weight:600;color:#111827;">testcustomer@example.com</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;">${serviceName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;">${time}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Vehicle</td><td style="padding:6px 0;font-weight:600;color:#111827;">2022 Toyota Camry (Black)</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;">$150</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;color:#111827;">123 Main St, Test City</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Notes</td><td style="padding:6px 0;font-weight:600;color:#111827;">Please bring extra microfiber cloths.</td></tr>
              </table>
            </div>
            <a href="https://detailbookapp.com/dashboard/bookings" style="display:inline-block;background:#2563EB;color:white;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">View in Dashboard</a>
          </div>
        </div>`,
    });
    return NextResponse.json({ type: "owner", ...result });
  }

  return NextResponse.json({ error: "Invalid type. Use 'customer' or 'owner'" }, { status: 400 });
}
