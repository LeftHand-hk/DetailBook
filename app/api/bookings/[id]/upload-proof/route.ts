import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/twilio";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = await request.json();
    const { proof } = body;

    if (!proof || typeof proof !== "string") {
      return NextResponse.json(
        { error: "Missing proof image data" },
        { status: 400 }
      );
    }

    if (!proof.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format. Please upload a JPG, PNG, or similar image." },
        { status: 400 }
      );
    }

    if (proof.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const wasConfirmed = booking.status === "confirmed";

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        paymentProof: proof,
        // Auto-confirm on proof upload (unless already confirmed/completed/cancelled)
        ...(booking.status === "pending" ? { status: "confirmed" } : {}),
      },
      include: { user: true },
    });

    // Send confirmation email + SMS if status transitioned to confirmed
    if (!wasConfirmed && updated.status === "confirmed") {
      const user = (updated as any).user;
      const formattedDate = new Date(updated.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });

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
        sendEmail({ to: updated.customerEmail, subject: `Booking Confirmed – ${updated.serviceName} on ${formattedDate}`, html: customerHtml, text: customerText }).catch(() => {});
      }

      if (user?.plan === "pro" && user?.smsConfirmations && updated.customerPhone) {
        const formattedDate2 = new Date(updated.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const smsBody =
          `Booking confirmed with ${user.businessName}!\n` +
          `Service: ${updated.serviceName}\n` +
          `Date: ${formattedDate2} at ${updated.time}\n` +
          (user.phone ? `Questions? Call ${user.phone}` : "");
        sendSms(updated.customerPhone, smsBody).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    console.error("POST /api/bookings/[id]/upload-proof error:", error);
    return NextResponse.json(
      { error: "Failed to upload proof" },
      { status: 500 }
    );
  }
}
