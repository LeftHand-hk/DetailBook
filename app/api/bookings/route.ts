import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { syncBookingToGoogleCalendar } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/twilio";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // If userId is provided, filter by it (must still be the authenticated user's own data)
    const targetUserId = userId || session.id;

    // Only allow fetching own bookings
    if (targetUserId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("GET /api/bookings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerEmail,
      customerPhone,
      vehicle,
      serviceId,
      serviceName,
      servicePrice,
      date,
      time,
      depositPaid,
      depositRequired,
      notes,
      address,
      status,
    } = body;

    // userId can come from body (public booking) or from session (dashboard)
    let userId = body.userId;
    if (!userId) {
      const session = await getSessionUser();
      if (session) userId = session.id;
    }

    if (!userId || !customerName || !customerEmail || !serviceName || !date || !time) {
      return NextResponse.json(
        { error: "Missing required booking fields" },
        { status: 400 }
      );
    }

    // Reject past dates
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      return NextResponse.json({ error: "Cannot book a date in the past" }, { status: 400 });
    }

    // Verify the target user exists and is not suspended
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.suspended) {
      return NextResponse.json({ error: "This business is not accepting bookings" }, { status: 403 });
    }

    // Enforce advance booking window
    if (user.advanceBookingDays) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + user.advanceBookingDays);
      const maxDateStr = maxDate.toISOString().split("T")[0];
      if (date > maxDateStr) {
        return NextResponse.json(
          { error: `Bookings can only be made up to ${user.advanceBookingDays} days in advance` },
          { status: 400 }
        );
      }
    }

    // Support both nested vehicle object and flat fields
    const vMake = vehicle?.make || body.vehicleMake || "";
    const vModel = vehicle?.model || body.vehicleModel || "";
    const vYear = vehicle?.year || body.vehicleYear || "";
    const vColor = vehicle?.color || body.vehicleColor || "";

    const booking = await prisma.booking.create({
      data: {
        userId,
        customerName,
        customerEmail,
        customerPhone: customerPhone || "",
        vehicleMake: vMake,
        vehicleModel: vModel,
        vehicleYear: vYear,
        vehicleColor: vColor,
        serviceId: serviceId || "",
        serviceName,
        servicePrice: parseFloat(servicePrice) || 0,
        date,
        time,
        depositPaid: depositPaid != null ? parseFloat(String(depositPaid)) : 0,
        depositRequired: depositRequired != null ? parseFloat(String(depositRequired)) : 0,
        notes: notes || null,
        address: address || null,
        status: status || "pending",
        staffId: body.staffId || null,
      },
    });

    // Auto-sync to Google Calendar (non-blocking)
    syncBookingToGoogleCalendar(booking).catch(() => {});

    // Format date nicely for emails
    const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    // 1. Confirmation email to customer (only if emailConfirmations is enabled, default true)
    if (customerEmail && (user as any).emailConfirmations !== false) {
      const depositNote = booking.depositRequired > 0
        ? `<p style="font-size:14px;color:#374151;">A deposit of <strong>$${booking.depositRequired}</strong> is due at the time of service.</p>`
        : "";
      const customerHtml = `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2563EB;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">${user.businessName}</div>
            <h1 style="margin:8px 0 0;font-size:22px;">Booking Confirmed!</h1>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="font-size:14px;color:#374151;">Hi ${customerName}, your booking has been received. Here are your details:</p>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:40%;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;">${serviceName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;">${time}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Vehicle</td><td style="padding:6px 0;font-weight:600;color:#111827;">${vYear} ${vMake} ${vModel} (${vColor})</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;">$${booking.servicePrice}</td></tr>
                ${booking.address ? `<tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;color:#111827;">${booking.address}</td></tr>` : ""}
              </table>
            </div>
            ${depositNote}
            ${user.phone ? `<p style="font-size:13px;color:#6b7280;">Questions? Contact us at <strong>${user.phone}</strong></p>` : ""}
            <p style="font-size:13px;color:#6b7280;">— ${user.businessName}</p>
          </div>
        </div>`;
      const customerText = `Booking Confirmed!\n\nHi ${customerName},\n\nService: ${serviceName}\nDate: ${formattedDate}\nTime: ${time}\nVehicle: ${vYear} ${vMake} ${vModel} (${vColor})\nPrice: $${booking.servicePrice}${booking.address ? `\nAddress: ${booking.address}` : ""}\n${booking.depositRequired > 0 ? `\nDeposit due: $${booking.depositRequired}` : ""}\n\n— ${user.businessName}`;
      sendEmail({ to: customerEmail, subject: `Booking Confirmed – ${serviceName} on ${formattedDate}`, html: customerHtml, text: customerText }).catch(() => {});
    }

    // 2. Notification email to business owner (only if emailReminders enabled, default true)
    if (user.email && user.emailReminders !== false) {
      const ownerHtml = `
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
                <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;font-weight:600;color:#111827;">${customerPhone || "—"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;font-weight:600;color:#111827;">${customerEmail}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;">${serviceName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;">${time}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Vehicle</td><td style="padding:6px 0;font-weight:600;color:#111827;">${vYear} ${vMake} ${vModel} (${vColor})</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;">$${booking.servicePrice}</td></tr>
                ${booking.address ? `<tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;color:#111827;">${booking.address}</td></tr>` : ""}
                ${notes ? `<tr><td style="padding:6px 0;color:#6b7280;">Notes</td><td style="padding:6px 0;font-weight:600;color:#111827;">${notes}</td></tr>` : ""}
              </table>
            </div>
            <a href="https://detailbookapp.com/dashboard/bookings" style="display:inline-block;background:#2563EB;color:white;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">View in Dashboard</a>
          </div>
        </div>`;
      sendEmail({ to: user.email, subject: `New Booking: ${customerName} – ${serviceName} on ${formattedDate}`, html: ownerHtml }).catch(() => {});
    }

    // 3. Confirmation SMS to customer (Pro plan only, if smsConfirmations enabled)
    if (user.plan === "pro" && (user as any).smsConfirmations && customerPhone) {
      const smsBody =
        `Booking confirmed with ${user.businessName}!\n` +
        `Service: ${serviceName}\n` +
        `Date: ${formattedDate} at ${time}\n` +
        (booking.depositRequired > 0 ? `Deposit due: $${booking.depositRequired}\n` : "") +
        (user.phone ? `Questions? Call ${user.phone}` : "");
      sendSms(customerPhone, smsBody).catch(() => {});
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error("POST /api/bookings error:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
