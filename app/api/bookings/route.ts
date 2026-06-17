import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser, isTrialExpired } from "@/lib/auth";
import { isValidEmail, escapeHtml } from "@/lib/validation";
import { syncBookingToGoogleCalendar } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/twilio";
import { normalizePhone } from "@/lib/phone";
import { verifyBookingPayment } from "@/lib/booking-payment";
import { bookingTimesOverlap } from "@/lib/booking-overlap";
import { calculateRequiredDeposit } from "@/lib/booking-deposit";

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
        // Customer's $cashtag / handle from manual-payment flows so the
        // owner can match incoming Cash App / PayPal payments to the
        // booking right from the list view.
        customerPaymentTag: true,
        selectedAddons: true,
        addonsTotal: true,
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

    // Public bookings supply userId. Dashboard bookings use the authenticated
    // owner session and are allowed to set administrative fields.
    const session = await getSessionUser();
    let userId = body.userId || session?.id;
    const isOwnerRequest = !!session && session.id === userId;
    if (session && body.userId && body.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !String(time).trim()) {
      return NextResponse.json({ error: "Enter a valid booking date and time" }, { status: 400 });
    }

    // Load the business once for availability, subscription, deposit, and
    // notification settings used throughout the booking hot path.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    if (user.suspended) {
      return NextResponse.json({ error: "This business is currently unavailable" }, { status: 403 });
    }
    if (isTrialExpired(user)) {
      return NextResponse.json({ error: "This business's subscription is inactive" }, { status: 403 });
    }

    // Reject past dates
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      return NextResponse.json({ error: "Cannot book a date in the past" }, { status: 400 });
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
    const vType = typeof body.vehicleType === "string" ? body.vehicleType.trim().toLowerCase() : "";

    // Look up the live package once so we can derive the authoritative
    // base price + vehicle surcharge server-side. We already needed the
    // package to validate add-ons; folding both into a single read keeps
    // the booking write to one DB round-trip on the hot path.
    let pkgRow: { name: string; price: number; deposit: number | null; duration: number; addons: unknown; vehiclePricing: unknown; userId: string } | null = null;
    if (serviceId) {
      pkgRow = await prisma.package.findUnique({
        where: { id: serviceId },
        select: { name: true, price: true, deposit: true, duration: true, addons: true, vehiclePricing: true, userId: true },
      });
      if (pkgRow && pkgRow.userId !== userId) pkgRow = null; // owner mismatch — ignore
    }

    // Sanitise selected addons against the package's actual addon list so
    // a customer can't inject a free-form item or trick us with a price.
    // We only keep entries the customer genuinely chose, snapshotting
    // the current name/price.
    let storedSelectedAddons:
      | { id: string; name: string; price: number }[]
      | null = null;
    let computedAddonsTotal = 0;
    if (pkgRow && Array.isArray(body.selectedAddons) && body.selectedAddons.length > 0 && Array.isArray(pkgRow.addons)) {
      const offered = pkgRow.addons as unknown as Array<{
        id?: string; name?: string; price?: number;
      }>;
      const requestedIds = new Set(
        (body.selectedAddons as unknown[])
          .map((a) => (a && typeof a === "object" ? (a as any).id : null))
          .filter((v): v is string => typeof v === "string"),
      );
      const matched = offered.filter((a) => a && a.id && requestedIds.has(a.id));
      if (matched.length > 0) {
        storedSelectedAddons = matched.map((a) => ({
          id: String(a.id),
          name: String(a.name || ""),
          price: Number(a.price) || 0,
        }));
        computedAddonsTotal = storedSelectedAddons.reduce((s, a) => s + (a.price || 0), 0);
        computedAddonsTotal = Math.round(computedAddonsTotal * 100) / 100;
      }
    }

    // Authoritative service price: package.price + per-vehicle surcharge.
    // Falls back to the client-provided servicePrice if we couldn't look
    // up the package (legacy clients, stale serviceId). When the package
    // has vehiclePricing configured, reject bookings whose vehicleType
    // isn't on the list — the customer would otherwise be quoted a
    // surcharge of $0 by accident.
    let finalServicePrice = parseFloat(servicePrice) || 0;
    if (pkgRow) {
      const { surchargeForVehicleType, packageSupportsVehicleType } = await import("@/lib/vehicle-pricing");
      const hasTierPricing = Array.isArray(pkgRow.vehiclePricing) && pkgRow.vehiclePricing.length > 0;
      if (hasTierPricing && !packageSupportsVehicleType(pkgRow.vehiclePricing, vType)) {
        return NextResponse.json(
          { error: "This service isn't offered for the selected vehicle type. Please pick a different package." },
          { status: 400 },
        );
      }
      finalServicePrice = pkgRow.price + surchargeForVehicleType(pkgRow.vehiclePricing, vType);
      finalServicePrice = Math.round(finalServicePrice * 100) / 100;
    } else if (!isOwnerRequest) {
      return NextResponse.json({ error: "This service is no longer available. Please choose it again." }, { status: 400 });
    }

    const bookingTotal = Math.round((finalServicePrice + computedAddonsTotal) * 100) / 100;
    const finalServiceName = pkgRow?.name || serviceName;
    const finalDuration = pkgRow?.duration || 60;
    const authoritativeDeposit = calculateRequiredDeposit({
      requireDeposit: user.requireDeposit,
      packageDeposit: pkgRow?.deposit,
      depositPercentage: user.depositPercentage,
      basePrice: pkgRow?.price ?? finalServicePrice,
    });

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

    let finalStatus = isOwnerRequest && ["pending", "confirmed", "completed", "cancelled"].includes(status)
      ? status
      : "pending";
    let finalDepositPaid = isOwnerRequest
      ? Math.max(0, Number.parseFloat(String(depositPaid ?? 0)) || 0)
      : 0;
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
        serviceName: finalServiceName,
        createdAt: { gte: dedupWindow },
      },
    });
    if (recentDuplicate) {
      return NextResponse.json(recentDuplicate, { status: 200 });
    }

    // Re-check the selected slot at write time. The public page's availability
    // data can become stale while a customer fills out the form.
    let finalStaffId = typeof body.staffId === "string" && body.staffId ? body.staffId : null;
    if (!isOwnerRequest) {
      const activeStaff = await prisma.staff.findMany({
        where: { userId, active: true },
        select: { id: true },
      });
      if (finalStaffId && !activeStaff.some((member) => member.id === finalStaffId)) {
        return NextResponse.json({ error: "The selected staff member is no longer available" }, { status: 400 });
      }
      const slotBookings = await prisma.booking.findMany({
        where: {
          userId,
          date,
          time,
          status: { in: ["pending", "confirmed", "in_progress"] },
        },
        select: { staffId: true },
      });
      if (activeStaff.length === 0) {
        if (slotBookings.length > 0) {
          return NextResponse.json({ error: "That time was just booked. Please choose another time." }, { status: 409 });
        }
      } else {
        const busyStaff = new Set(slotBookings.map((booking) => booking.staffId).filter(Boolean));
        if (finalStaffId && busyStaff.has(finalStaffId)) {
          return NextResponse.json({ error: "That staff member was just booked. Please choose another time." }, { status: 409 });
        }
        if (!finalStaffId) {
          finalStaffId = activeStaff.find((member) => !busyStaff.has(member.id))?.id || null;
          if (!finalStaffId) {
            return NextResponse.json({ error: "That time was just booked. Please choose another time." }, { status: 409 });
          }
        }
      }
    }

    // Do the inexpensive availability check before the external processor
    // verification so stale submissions fail quickly.
    if (!isOwnerRequest && safeProof && (safeProof.startsWith("stripe:") || safeProof.startsWith("square:"))) {
      const verification = await verifyBookingPayment(userId, safeProof, authoritativeDeposit);
      if (!verification.paid) {
        return NextResponse.json(
          { error: verification.reason || "Card payment could not be verified" },
          { status: 402 },
        );
      }
      finalStatus = "confirmed";
      finalDepositPaid = verification.amount;
    }

    // Brief #16: link or auto-create the matching Customer row for
    // this business. Match precedence: email first, phone fallback.
    // This dedupes the dashboard's Customers list so a returning
    // customer doesn't get a fresh row on every booking. Empty inputs
    // skip the lookup so we don't merge on "no contact info" matches.
    let customerLinkId: string | null = null;
    let createdCustomerId: string | null = null;
    const normEmail = (customerEmail || "").trim().toLowerCase();
    const normPhone = (customerPhone || "").trim();
    const digitsPhone = normalizePhone(normPhone);
    if (normEmail || normPhone) {
      const matchOr: any[] = [];
      if (normEmail) matchOr.push({ email: normEmail });
      if (normPhone) matchOr.push({ phone: normPhone });
      let match = await prisma.customer.findFirst({
        where: { userId, OR: matchOr },
        select: { id: true },
      });
      // No exact hit but we have a phone — the existing customer's number may
      // just be stored in a different format, so compare digits across this
      // business's phone-bearing customers before creating a duplicate.
      if (!match && digitsPhone) {
        const withPhone = await prisma.customer.findMany({
          where: { userId, phone: { not: null } },
          select: { id: true, phone: true },
        });
        const hit = withPhone.find((c) => normalizePhone(c.phone) === digitsPhone);
        if (hit) match = { id: hit.id };
      }
      if (match) {
        customerLinkId = match.id;
        // Keep the CRM vehicle current from the customer's latest booking.
        await prisma.customer.updateMany({
          where: { id: match.id, userId },
          data: {
            ...(vMake ? { vehicleMake: vMake } : {}),
            ...(vModel ? { vehicleModel: vModel } : {}),
            ...(vYear ? { vehicleYear: vYear } : {}),
            ...(vColor ? { vehicleColor: vColor } : {}),
          },
        });
      } else {
        const [first, ...rest] = (customerName || "").trim().split(/\s+/);
        const created = await prisma.customer.create({
          data: {
            userId,
            firstName: first || (normEmail || normPhone || "Customer"),
            lastName: rest.length ? rest.join(" ") : null,
            email: normEmail || null,
            phone: normPhone || null,
            vehicleMake: vMake || null,
            vehicleModel: vModel || null,
            vehicleYear: vYear || null,
            vehicleColor: vColor || null,
          },
        });
        customerLinkId = created.id;
        createdCustomerId = created.id;
      }
    }

    const slotLockKey = `${userId}|${date}`;
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${slotLockKey})) AS locked
      `;
      if (!lockRows[0]?.locked) {
        if (createdCustomerId) await tx.customer.delete({ where: { id: createdCustomerId } });
        return {
          booking: null,
          duplicate: false,
          conflict: "That time is being booked right now. Please try another time.",
        };
      }
      const duplicate = await tx.booking.findFirst({
        where: {
          userId,
          customerEmail,
          date,
          time,
          serviceName: finalServiceName,
          createdAt: { gte: dedupWindow },
        },
      });
      if (duplicate) {
        if (createdCustomerId) await tx.customer.delete({ where: { id: createdCustomerId } });
        return { booking: duplicate, duplicate: true, conflict: null };
      }
      let transactionStaffId = finalStaffId;
      if (!isOwnerRequest) {
        const lockedSlotBookings = await tx.booking.findMany({
          where: { userId, date, status: { in: ["pending", "confirmed", "in_progress"] } },
          select: { staffId: true, time: true, serviceId: true },
        });
        const packageIds = Array.from(new Set(lockedSlotBookings.map((booking) => booking.serviceId).filter(Boolean)));
        const durations = new Map((await tx.package.findMany({
          where: { id: { in: packageIds }, userId },
          select: { id: true, duration: true },
        })).map((pkg) => [pkg.id, pkg.duration]));
        const overlappingBookings = lockedSlotBookings.filter((booking) =>
          bookingTimesOverlap(time, finalDuration, booking.time, durations.get(booking.serviceId) || 60)
        );
        const slotTaken = transactionStaffId
          ? overlappingBookings.some((locked) => locked.staffId === transactionStaffId)
          : overlappingBookings.length > 0;
        if (slotTaken && body.staffAutoAssigned === true) {
          const busyStaff = new Set(overlappingBookings.map((locked) => locked.staffId).filter(Boolean));
          transactionStaffId = (await tx.staff.findMany({
            where: { userId, active: true },
            select: { id: true },
          })).find((member) => !busyStaff.has(member.id))?.id || null;
        }
        if (slotTaken && (body.staffAutoAssigned !== true || !transactionStaffId)) {
          if (createdCustomerId) await tx.customer.delete({ where: { id: createdCustomerId } });
          return {
            booking: null,
            duplicate: false,
            conflict: "That time was just booked. Please choose another time.",
          };
        }
      }

      const booking = await tx.booking.create({
        data: {
        userId,
        customerId: customerLinkId,
        customerName,
        customerEmail,
        customerPhone: customerPhone || "",
        vehicleMake: vMake,
        vehicleModel: vModel,
        vehicleYear: vYear,
        vehicleColor: vColor,
        vehicleType: vType,
        serviceId: serviceId || "",
        serviceName: finalServiceName,
        servicePrice: finalServicePrice,
        date,
        time,
        depositPaid: finalDepositPaid,
        depositRequired: isOwnerRequest
          ? Math.max(0, Number.parseFloat(String(depositRequired ?? 0)) || 0)
          : authoritativeDeposit,
        notes: notes || null,
        address: address || null,
        status: finalStatus,
        staffId: transactionStaffId,
        paymentMethod: body.paymentMethod || "",
        paymentProof: safeProof,
        // Customer-supplied identifier for non-card payments (e.g. their
        // own $cashtag for Cash App) so the owner can match the incoming
        // payment to this booking. Trimmed of a leading $ to stay
        // consistent regardless of what the customer typed.
        customerPaymentTag: typeof body.customerPaymentTag === "string"
          ? body.customerPaymentTag.trim().replace(/^\$/, "")
          : null,
        selectedAddons: storedSelectedAddons === null ? undefined : (storedSelectedAddons as any),
        addonsTotal: computedAddonsTotal,
        },
      });
      await tx.notification.create({
        data: {
          userId,
          type: "booking_new",
          title: "New booking",
          message: `${customerName} booked ${booking.serviceName} for ${date} at ${time}`,
          bookingId: booking.id,
        },
        select: { id: true },
      });
      return { booking, duplicate: false, conflict: null };
      }, { maxWait: 20_000, timeout: 30_000 });
    } catch (error) {
      if (createdCustomerId) {
        await prisma.customer.deleteMany({
          where: { id: createdCustomerId, bookings: { none: {} } },
        }).catch(() => {});
      }
      throw error;
    }
    if (result.conflict) return NextResponse.json({ error: result.conflict }, { status: 409 });
    if (result.duplicate) return NextResponse.json(result.booking, { status: 200 });
    const booking = result.booking!;

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
    const eServiceName = escapeHtml(booking.serviceName);
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

    // Formatted add-on lines for the owner email + a clean total. Empty
    // string when no add-ons so the booking email stays unchanged for
    // packages that don't offer them.
    const addonRowsHtml = (storedSelectedAddons || [])
      .map((a) => `<tr><td style="padding:6px 0;color:#6b7280;">+ ${escapeHtml(a.name)}</td><td style="padding:6px 0;font-weight:600;color:#111827;">$${a.price}</td></tr>`)
      .join("");
    const grandTotal = bookingTotal;

    // Collect all email/SMS sends and await them at the end. On Netlify (and
    // any serverless host) the Node runtime is frozen the moment we return
    // the response, which silently kills any in-flight fire-and-forget
    // promises — that's why a fast `.then().catch()` send was unreliable.
    const pendingSends: Promise<unknown>[] = [];

    // Manual bookings from the dashboard Add-booking modal set this so we
    // don't fire any notification — the owner is the one who just typed
    // it in, and they may not want to email a walk-in customer either.
    const skipNotifications = body.skipNotifications === true;

    // 1. Notification email to business owner (only if emailReminders enabled, default true)
    if (!skipNotifications && user.email && user.emailReminders !== false) {
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
                ${addonRowsHtml}
                ${addonRowsHtml ? `<tr><td style="padding:6px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Total</td><td style="padding:6px 0;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;">$${grandTotal}</td></tr>` : ""}
                ${booking.address ? `<tr><td style="padding:6px 0;color:#6b7280;">Address</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eAddress}</td></tr>` : ""}
                ${notes ? `<tr><td style="padding:6px 0;color:#6b7280;">Notes</td><td style="padding:6px 0;font-weight:600;color:#111827;">${eNotes}</td></tr>` : ""}
              </table>
            </div>
            ${safeProof && safeProof.startsWith("data:image/") ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 14px;margin:0 0 16px;">
              <p style="margin:0;font-size:13px;color:#92400E;"><strong>Payment proof attached.</strong> Review in your dashboard before confirming the booking.</p>
            </div>` : ""}
            <a href="https://detailbookapp.com/dashboard/bookings" style="display:inline-block;background:#2563EB;color:white;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">View in Dashboard</a>
          </div>
        </div>`;
      pendingSends.push(
        sendEmail({ to: user.email, subject: `New Booking: ${customerName} - ${booking.serviceName} on ${formattedDate}`, html: ownerHtml })
          .catch((err) => console.error("[booking owner email] threw:", err)),
      );
    }

    // If the booking is created already "confirmed" (card payment paid),
    // send the customer confirmation email + SMS the same way PUT does on
    // a status transition. Fire-and-forget. Manual dashboard adds skip
    // this so a walk-in customer doesn't get an unexpected email.
    if (!skipNotifications && booking.status === "confirmed") {
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
        pendingSends.push(
          sendEmail({ to: booking.customerEmail, subject: `Booking Confirmed – ${booking.serviceName} on ${formattedDate}`, html: customerHtml, text: customerText })
            .then((r) => console.log("[CONFIRM POST EMAIL] Result:", r))
            .catch((err) => console.error("[CONFIRM POST EMAIL] threw:", err)),
        );
      }

      if ((user as any).plan === "pro" && (user as any).smsConfirmations && booking.customerPhone) {
        const smsTemplate = ((user as any).smsTemplates as any)?.bookingConfirmation || DEFAULT_SMS;
        const smsBody = render(smsTemplate);
        pendingSends.push(
          sendSms(booking.customerPhone, smsBody)
            .then((r) => console.log("[CONFIRM POST SMS] Result:", r))
            .catch((err) => console.error("[CONFIRM POST SMS] threw:", err)),
        );
      } else {
        console.log("[CONFIRM POST SMS] Skipped — gate not met:", {
          plan: (user as any).plan,
          smsConfirmations: (user as any).smsConfirmations,
          hasCustomerPhone: !!booking.customerPhone,
        });
      }
    }

    // Await all queued email/SMS sends before responding so the serverless
    // runtime doesn't terminate the function with sends still in-flight.
    if (pendingSends.length > 0) {
      await Promise.allSettled(pendingSends);
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
