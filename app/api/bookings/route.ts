import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, isTrialExpired } from "@/lib/auth";
import { isValidEmail, escapeHtml } from "@/lib/validation";
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

    // List view: exclude heavy paymentProof base64 (can be up to ~28MB per row).
    // Detail panel loads it on demand via GET /api/bookings/[id].
    const bookings = await prisma.booking.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        vehicleMake: true,
        vehicleModel: true,
        vehicleYear: true,
        vehicleColor: true,
        serviceId: true,
        serviceName: true,
        servicePrice: true,
        date: true,
        time: true,
        depositPaid: true,
        depositRequired: true,
        notes: true,
        address: true,
        status: true,
        staffId: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
      },
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

    if (!isValidEmail(customerEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Check if business owner's trial/subscription is active
    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { trialEndsAt: true, subscriptionStatus: true, suspended: true } });
    if (!owner) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    if (owner.suspended) {
      return NextResponse.json({ error: "This business is currently unavailable" }, { status: 403 });
    }
    if (isTrialExpired(owner)) {
      return NextResponse.json({ error: "This business's subscription is inactive" }, { status: 403 });
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

    // paymentProof is either a "stripe:<payment_intent_id>" / "square:<payment_id>"
    // reference (set by the embedded card modals after a successful charge) or
    // a legacy base64 data URL from the old proof-upload UI. Reject anything
    // else, and cap base64 size so a megabyte payload can't blow up the row.
    const rawProof = typeof body.paymentProof === "string" ? body.paymentProof : null;
    let safeProof: string | null = null;
    if (rawProof) {
      const isPaymentRef = rawProof.startsWith("stripe:") || rawProof.startsWith("square:");
      const isDataUrl = rawProof.startsWith("data:image/");
      if (!isPaymentRef && !isDataUrl) {
        return NextResponse.json(
          { error: "Invalid payment proof format." },
          { status: 400 }
        );
      }
      if (isDataUrl && rawProof.length > 28 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Payment proof image is too large. Max 20MB." },
          { status: 400 }
        );
      }
      safeProof = rawProof;
    }

    // Idempotency guard: if the same customer just submitted the same slot
    // (double-click, network retry, refresh during slow request), return the
    // existing booking instead of creating a duplicate.
    const dedupWindow = new Date(Date.now() - 60_000);
    const recentDuplicate = await prisma.booking.findFirst({
      where: {
        userId,
        customerEmail,
        date,
        time,
        serviceName,
        createdAt: { gte: dedupWindow },
      },
    });
    if (recentDuplicate) {
      return NextResponse.json(recentDuplicate, { status: 200 });
    }

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
        paymentMethod: body.paymentMethod || "",
        paymentProof: safeProof,
      },
    });

    // Create in-app notification for the business owner — fire and forget so
    // the booking response isn't blocked by it.
    prisma.notification.create({
      data: {
        userId,
        type: "booking_new",
        title: "New booking",
        message: `${customerName} booked ${serviceName} for ${date} at ${time}`,
        bookingId: booking.id,
      },
    }).catch(() => {});

    // Auto-sync to Google Calendar (non-blocking)
    syncBookingToGoogleCalendar(booking).catch(() => {});

    // Format date nicely for emails
    const formattedDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    // Escape user-supplied fields before embedding in email HTML
    const eCustomerName = escapeHtml(customerName);
    const eCustomerEmail = escapeHtml(customerEmail);
    const eCustomerPhone = escapeHtml(customerPhone || "");
    const eServiceName = escapeHtml(serviceName);
    const eTime = escapeHtml(time);
    const eVYear = escapeHtml(String(vYear));
    const eVMake = escapeHtml(String(vMake));
    const eVModel = escapeHtml(String(vModel));
    const eVColor = escapeHtml(String(vColor));
    const eAddress = escapeHtml(booking.address || "");
    const eNotes = escapeHtml(notes || "");
    const eBusinessName = escapeHtml(user.businessName || "");
    const eCustomMessage = escapeHtml((user as any).customMessage || "");
    const ePhoneOrEmail = escapeHtml(user.phone || user.email || "");

    // 1. Notification email to business owner (only if emailReminders enabled, default true)
    if (user.email && user.emailReminders !== false) {
      const ownerHtml = `
        <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2563EB;color:white;padding:24px;border-radius:8px 8px 0 0;">
            <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;">DetailBook</div>
            <h1 style="margin:8px 0 0;font-size:22px;">New Booking!</h1>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="font-size:14px;color:#374151;">You have a new booking from <strong>${eCustomerName}</strong>.</p>
            <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#6b7280;width:40%;">Customer</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eCustomerName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eCustomerPhone || "—"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eCustomerEmail}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eServiceName}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eTime}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Vehicle</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eVYear} ${eVMake} ${eVModel} (${eVColor})</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;">$${booking.servicePrice}</td></tr>
                ${booking.address ? `<tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eAddress}</td></tr>` : ""}
                ${notes ? `<tr><td style="padding:6px 0;color:#6b7280;">Notes</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eNotes}</td></tr>` : ""}
              </table>
            </div>
            ${safeProof ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 14px;margin:0 0 16px;">
              <p style="margin:0;font-size:13px;color:#92400E;"><strong>Payment proof attached.</strong> Review in your dashboard before confirming the booking.</p>
            </div>` : ""}
            <a href="https://detailbookapp.com/dashboard/bookings" style="display:inline-block;background:#2563EB;color:white;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">View in Dashboard</a>
          </div>
        </div>`;
      sendEmail({ to: user.email, subject: `New Booking: ${customerName} - ${serviceName} on ${formattedDate}`, html: ownerHtml }).catch(() => {});
    }

    // If the booking is created already "confirmed" (card payment paid),
    // send the customer confirmation email + SMS the same way PUT does on
    // a status transition. Fire-and-forget.
    if (booking.status === "confirmed") {
      console.log("[CONFIRM POST] Booking", booking.id, "created as confirmed. Sending notifications.", {
        hasCustomerEmail: !!booking.customerEmail,
        emailConfirmations: (user as any).emailConfirmations,
        plan: (user as any).plan,
        smsConfirmations: (user as any).smsConfirmations,
        hasCustomerPhone: !!booking.customerPhone,
      });
      const ctx: Record<string, string> = {
        customerName: booking.customerName || "",
        serviceName: booking.serviceName || "",
        date: formattedDate,
        time: booking.time || "",
        businessName: user.businessName || "",
      };
      const render = (tpl: string) =>
        tpl.replace(/\{(\w+)\}/g, (_m, k) => ctx[k] ?? "");

      const DEFAULT_SMS =
        "Hi {customerName}, your {serviceName} appointment is confirmed for {date} at {time}. — {businessName}";
      const DEFAULT_EMAIL =
        "Dear {customerName},\n\nYour booking for {serviceName} has been confirmed!\n\nDate: {date}\nTime: {time}\n\nWe look forward to seeing you!\n\n— {businessName}";

      if (booking.customerEmail && (user as any).emailConfirmations !== false) {
        const emailTemplate = ((user as any).emailTemplates as any)?.bookingConfirmation || DEFAULT_EMAIL;
        const customerText = render(emailTemplate);
        const customerHtml = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap;">${customerText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        sendEmail({ to: booking.customerEmail, subject: `Booking Confirmed – ${booking.serviceName} on ${formattedDate}`, html: customerHtml, text: customerText })
          .then((r) => console.log("[CONFIRM POST EMAIL] Result:", r))
          .catch((err) => console.error("[CONFIRM POST EMAIL] threw:", err));
      }

      if ((user as any).plan === "pro" && (user as any).smsConfirmations && booking.customerPhone) {
        const smsTemplate = ((user as any).smsTemplates as any)?.bookingConfirmation || DEFAULT_SMS;
        const smsBody = render(smsTemplate);
        sendSms(booking.customerPhone, smsBody)
          .then((r) => console.log("[CONFIRM POST SMS] Result:", r))
          .catch((err) => console.error("[CONFIRM POST SMS] threw:", err));
      } else {
        console.log("[CONFIRM POST SMS] Skipped — gate not met:", {
          plan: (user as any).plan,
          smsConfirmations: (user as any).smsConfirmations,
          hasCustomerPhone: !!booking.customerPhone,
        });
      }
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
