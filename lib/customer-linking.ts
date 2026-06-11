import prisma from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

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
  if (normPhone) orParts.push({ AND: [{ customerPhone: { not: null } }, { customerPhone: { not: "" } }] });

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
