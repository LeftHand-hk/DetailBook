import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/twilio";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("GET /api/bookings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Handle nested vehicle object from frontend
    const vehicle = body.vehicle;
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.depositPaid !== undefined) data.depositPaid = parseFloat(body.depositPaid);
    if (body.customerName !== undefined) data.customerName = body.customerName;
    if (body.customerEmail !== undefined) data.customerEmail = body.customerEmail;
    if (body.customerPhone !== undefined) data.customerPhone = body.customerPhone;
    if (body.date !== undefined) data.date = body.date;
    if (body.time !== undefined) data.time = body.time;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.address !== undefined) data.address = body.address;
    // Support both flat and nested vehicle
    if (vehicle) {
      if (vehicle.make !== undefined) data.vehicleMake = vehicle.make;
      if (vehicle.model !== undefined) data.vehicleModel = vehicle.model;
      if (vehicle.year !== undefined) data.vehicleYear = vehicle.year;
      if (vehicle.color !== undefined) data.vehicleColor = vehicle.color;
    }
    if (body.vehicleMake !== undefined) data.vehicleMake = body.vehicleMake;
    if (body.vehicleModel !== undefined) data.vehicleModel = body.vehicleModel;
    if (body.vehicleYear !== undefined) data.vehicleYear = body.vehicleYear;
    if (body.vehicleColor !== undefined) data.vehicleColor = body.vehicleColor;
    if (body.staffId !== undefined) data.staffId = body.staffId || null;

    const updated = await prisma.booking.update({
      where: { id },
      data,
      include: { user: true },
    });

    // Send confirmation email + SMS when status changes to "confirmed"
    console.log("[BOOKING PUT] Status transition:", {
      bookingId: id,
      bodyStatus: body.status,
      existingStatus: existing.status,
      willTriggerNotifications: body.status === "confirmed" && existing.status !== "confirmed",
    });
    if (body.status === "confirmed" && existing.status !== "confirmed") {
      const user = (updated as any).user;
      console.log("[CONFIRM EMAIL] Attempting to send to:", updated.customerEmail, "| SMTP_HOST:", process.env.SMTP_HOST || "NOT SET", "| emailConfirmations:", user?.emailConfirmations);
      const formattedDate = new Date(updated.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });

      // Confirmation email to customer
      if (updated.customerEmail && user?.emailConfirmations !== false) {
        const customerHtml = `
          <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#2563EB;color:white;padding:24px;border-radius:8px 8px 0 0;">
              <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">${user.businessName}</div>
              <h1 style="margin:8px 0 0;font-size:22px;">Booking Confirmed!</h1>
            </div>
            <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
              <p style="font-size:14px;color:#374151;">Hi ${updated.customerName}, your booking has been confirmed. Here are your details:</p>
              <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
                <table style="width:100%;font-size:14px;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;color:#6b7280;width:40%;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;">${updated.serviceName}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;">${updated.time}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Vehicle</td><td style="padding:6px 0;font-weight:600;color:#111827;">${updated.vehicleYear} ${updated.vehicleMake} ${updated.vehicleModel} (${updated.vehicleColor})</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7280;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;">$${updated.servicePrice}</td></tr>
                  ${updated.address ? `<tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;color:#111827;">${updated.address}</td></tr>` : ""}
                </table>
              </div>
              ${user.phone ? `<p style="font-size:13px;color:#6b7280;">Questions? Contact us at <strong>${user.phone}</strong></p>` : ""}
              <p style="font-size:13px;color:#6b7280;">— ${user.businessName}</p>
            </div>
          </div>`;
        const customerText = `Booking Confirmed!\n\nHi ${updated.customerName},\n\nService: ${updated.serviceName}\nDate: ${formattedDate}\nTime: ${updated.time}\nPrice: $${updated.servicePrice}${updated.address ? `\nAddress: ${updated.address}` : ""}\n\n— ${user.businessName}`;
        const emailResult = await sendEmail({ to: updated.customerEmail, subject: `Booking Confirmed – ${updated.serviceName} on ${formattedDate}`, html: customerHtml, text: customerText });
        console.log("[CONFIRM EMAIL] Result:", emailResult);
      }

      // Confirmation SMS to customer (Pro only)
      console.log("[CONFIRM SMS] Conditions:", {
        plan: user?.plan,
        smsConfirmations: user?.smsConfirmations,
        customerPhone: updated.customerPhone || "(empty)",
        hasMessagingService: !!process.env.TWILIO_MESSAGING_SERVICE_SID,
        hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
        hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
      });
      if (user?.plan === "pro" && user?.smsConfirmations && updated.customerPhone) {
        const formattedDate2 = new Date(updated.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const smsBody =
          `Booking confirmed with ${user.businessName}!\n` +
          `Service: ${updated.serviceName}\n` +
          `Date: ${formattedDate2} at ${updated.time}\n` +
          (user.phone ? `Questions? Call ${user.phone}` : "");
        const smsResult = await sendSms(updated.customerPhone, smsBody).catch((err) => {
          console.error("[CONFIRM SMS] sendSms threw:", err);
          return { success: false, error: String(err) };
        });
        console.log("[CONFIRM SMS] Result:", smsResult);
      } else {
        console.log("[CONFIRM SMS] Skipped — at least one condition is false");
      }
    }

    const { user: _user, ...updatedWithoutUser } = updated as any;
    return NextResponse.json(updatedWithoutUser);
  } catch (error) {
    console.error("PUT /api/bookings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (existing.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.booking.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/bookings/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete booking" },
      { status: 500 }
    );
  }
}
