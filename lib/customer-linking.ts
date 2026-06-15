import prisma from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

export async function findMatchingCustomer(
  userId: string,
  email: string | null | undefined,
  phone: string | null | undefined,
  excludeId?: string,
) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const normPhone = normalizePhone(phone);
  const exclude = excludeId ? { id: { not: excludeId } } : {};

  if (cleanEmail) {
    const byEmail = await prisma.customer.findFirst({
      where: { userId, email: cleanEmail, ...exclude },
    });
    if (byEmail) return byEmail;
  }

  if (!normPhone) return null;
  const phoneCandidates = await prisma.customer.findMany({
    where: { userId, phone: { not: null }, ...exclude },
  });
  return phoneCandidates.find((customer) => normalizePhone(customer.phone) === normPhone) || null;
}

export async function syncBookingCustomer(
  userId: string,
  booking: {
    id: string;
    customerId: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: string;
    vehicleColor: string;
  },
) {
  const email = booking.customerEmail.trim().toLowerCase() || null;
  const phone = booking.customerPhone.trim() || null;
  if (!email && !phone) return;

  let matched = await findMatchingCustomer(userId, email, phone);
  if (!matched && booking.customerId) {
    matched = await prisma.customer.findFirst({
      where: { id: booking.customerId, userId },
    });
  }
  const nameParts = booking.customerName.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || "Customer";
  const customerData = {
    firstName,
    lastName: nameParts.join(" ") || null,
    email: email || matched?.email || null,
    phone: phone || matched?.phone || null,
    vehicleMake: booking.vehicleMake.trim() || null,
    vehicleModel: booking.vehicleModel.trim() || null,
    vehicleYear: booking.vehicleYear.trim() || null,
    vehicleColor: booking.vehicleColor.trim() || null,
  };
  const customer = matched
    ? await prisma.customer.update({ where: { id: matched.id }, data: customerData })
    : await prisma.customer.create({ data: { userId, ...customerData } });

  if (booking.customerId !== customer.id) {
    await prisma.booking.update({ where: { id: booking.id }, data: { customerId: customer.id } });
  }
}

// When a Customer row is created or its contact info changes, sweep the
// Booking table for "orphan" rows (customerId = null) under the same
// business whose customerEmail OR customerPhone matches — link them so
// the dashboard list shows real counts and the detail page picks up
// the history. Idempotent: only writes orphans, so re-running is safe.
//
// Email matches exactly (case-insensitive). Phone matches on digits only, so
// a booking saved as "+1 (555) 123-4567" still links to a customer stored as
// "555-123-4567". SQL can't normalise, so we pull the unlinked rows that have
// a phone and compare in app code.
export async function linkOrphanBookings(
  userId: string,
  customerId: string,
  email: string | null,
  phone: string | null,
): Promise<number> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const normPhone = normalizePhone(phone);
  if (!cleanEmail && !normPhone) return 0;

  const orParts: any[] = [];
  if (cleanEmail) orParts.push({ customerEmail: cleanEmail });
  if (normPhone) orParts.push({ customerPhone: { not: "" } });

  const candidates = await prisma.booking.findMany({
    where: { userId, customerId: null, OR: orParts },
    select: { id: true, customerEmail: true, customerPhone: true },
  });

  const matchedIds = candidates
    .filter(
      (b) =>
        (cleanEmail && (b.customerEmail || "").toLowerCase() === cleanEmail) ||
        (normPhone && normalizePhone(b.customerPhone) === normPhone),
    )
    .map((b) => b.id);
  if (matchedIds.length === 0) return 0;

  const result = await prisma.booking.updateMany({
    where: { id: { in: matchedIds }, customerId: null },
    data: { customerId },
  });
  return result.count;
}
