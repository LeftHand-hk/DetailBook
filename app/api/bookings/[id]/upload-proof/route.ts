import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

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

    const updated = await prisma.booking.update({
      where: { id },
      data: { paymentProof: proof },
      include: { user: true },
    });

    // Notify the business owner that proof was submitted so they can review and confirm.
    const user = (updated as any).user;
    if (user?.email && user?.emailReminders !== false) {
      const formattedDate = new Date(updated.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
      const ownerHtml = `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#F59E0B;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <div style="font-size:12px;opacity:0.9;text-transform:uppercase;letter-spacing:1px;">DetailBook</div>
            <h1 style="margin:8px 0 0;font-size:22px;">Payment Proof Submitted</h1>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="font-size:14px;color:#374151;"><strong>${updated.customerName}</strong> uploaded a deposit payment proof. Review it and confirm the booking in your dashboard.</p>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:40%;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;">${updated.serviceName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;">${updated.time}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Deposit</td><td style="padding:6px 0;font-weight:600;color:#111827;">$${updated.depositRequired}</td></tr>
              </table>
            </div>
            <a href="https://detailbookapp.com/dashboard/bookings" style="display:inline-block;background:#F59E0B;color:white;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Review & Confirm</a>
          </div>
        </div>`;
      sendEmail({
        to: user.email,
        subject: `Payment Proof – ${updated.customerName} (${updated.serviceName})`,
        html: ownerHtml,
      }).catch(() => {});
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
