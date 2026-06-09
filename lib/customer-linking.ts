import prisma from "@/lib/prisma";

// When a Customer row is created or its contact info changes, sweep the
// Booking table for "orphan" rows (customerId = null) under the same
// business whose customerEmail OR customerPhone matches — link them so
// the dashboard list shows real counts and the detail page picks up
// the history. Idempotent: only writes orphans, so re-running is safe.
export async function linkOrphanBookings(
  userId: string,
  customerId: string,
  email: string | null,
  phone: string | null,
): Promise<number> {
  const orParts: any[] = [];
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPhone = (phone || "").trim();
  if (cleanEmail) orParts.push({ customerEmail: cleanEmail });
  if (cleanPhone) orParts.push({ customerPhone: cleanPhone });
  if (orParts.length === 0) return 0;

  const result = await prisma.booking.updateMany({
    where: { userId, customerId: null, OR: orParts },
    data: { customerId },
  });
  return result.count;
}
