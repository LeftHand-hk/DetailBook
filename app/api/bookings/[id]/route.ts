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

    // Atomic status-transition guard: if we're moving to "confirmed",
    // only one concurrent request should "win" the transition. updateMany
    // applies the where filter atomically — count===0 means another
    // request already flipped the status, so we must NOT re-send notifications.
    let didTransitionToConfirmed = false;
    if (body.status === "confirmed" && existing.status !== "confirmed") {
      const r = await prisma.booking.updateMany({
        where: { id, status: { not: "confirmed" } },
        data,
      });
      didTransitionToConfirmed = r.count > 0;
      if (!didTransitionToConfirmed) {
        // Lost the race — apply non-status fields only so we don't trample
        // anyone else's confirmation.
        const { status: _s, ...rest } = data as any;
        if (Object.keys(rest).length > 0) {
          await prisma.booking.update({ where: { id }, data: rest });
        }
      }
    } else {
      await prisma.booking.update({ where: { id }, data });
    }

    const updated = await prisma.booking.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!updated) {
      return NextResponse.json({ error: "Booking disappeared" }, { status: 500 });
    }

    // Send confirmation email + SMS when status changes to "confirmed".
    // Fire-and-forget so the dashboard doesn't wait on SMTP/Twilio (which can
    // take seconds and block the optimistic UI update from being acknowledged).
    if (didTransitionToConfirmed) {
      const user = (updated as any).user;
      const formattedDate = new Date(updated.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });

      const ctx: Record<string, string> = {
        customerName: updated.customerName || "",
        serviceName: updated.serviceName || "",
        date: formattedDate,
        time: updated.time || "",
        businessName: user?.businessName || "",
      };
      const render = (tpl: string) =>
        tpl.replace(/\{(\w+)\}/g, (_m, k) => ctx[k] ?? "");

      const DEFAULT_SMS =
        "Hi {customerName}, your {serviceName} appointment is confirmed for {date} at {time}. — {businessName}";
      const DEFAULT_EMAIL =
        "Dear {customerName},\n\nYour booking for {serviceName} has been confirmed!\n\nDate: {date}\nTime: {time}\n\nWe look forward to seeing you!\n\n— {businessName}";

      console.log("[CONFIRM] Booking", id, "transitioned to confirmed. Sending notifications.", {
        hasCustomerEmail: !!updated.customerEmail,
        emailConfirmations: user?.emailConfirmations,
        plan: user?.plan,
        smsConfirmations: user?.smsConfirmations,
        hasCustomerPhone: !!updated.customerPhone,
      });

      // Confirmation email to customer (uses configured template, falls back to default)
      if (updated.customerEmail && user?.emailConfirmations !== false) {
        const emailTemplate = (user?.emailTemplates as any)?.bookingConfirmation || DEFAULT_EMAIL;
        const customerText = render(emailTemplate);
        const customerHtml = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap;">${customerText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        sendEmail({ to: updated.customerEmail, subject: `Booking Confirmed – ${updated.serviceName} on ${formattedDate}`, html: customerHtml, text: customerText })
          .then((r) => console.log("[CONFIRM EMAIL] Result:", r))
          .catch((err) => console.error("[CONFIRM EMAIL] threw:", err));
      }

      // Confirmation SMS to customer (Pro only)
      if (user?.plan === "pro" && user?.smsConfirmations && updated.customerPhone) {
        const smsTemplate = (user?.smsTemplates as any)?.bookingConfirmation || DEFAULT_SMS;
        const smsBody = render(smsTemplate);
        sendSms(updated.customerPhone, smsBody)
          .then((r) => console.log("[CONFIRM SMS] Result:", r))
          .catch((err) => console.error("[CONFIRM SMS] threw:", err));
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
