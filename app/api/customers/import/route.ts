import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { linkOrphanBookings } from "@/lib/customer-linking";
import { normalizePhone } from "@/lib/phone";

// POST /api/customers/import
// Body: { rows: Array<{ firstName, lastName?, email?, phone?, ... }> }
// Dedup rule: same userId AND same non-empty email → skip. Otherwise
// skip on duplicate phone (same userId AND same non-empty phone).
// Empty rows (no firstName + no email + no phone) are silently dropped.
//
// Built for big imports (1000+ contacts from a phone .vcf): valid rows are
// collected in memory, inserted with createMany in chunks (one round-trip
// per chunk, not per row), and orphan-booking linking runs only against the
// orphans that actually exist — so the whole thing stays well inside the
// serverless function timeout.

const INSERT_CHUNK = 500;

// Link pre-existing "orphan" bookings (customerId = null) to the customers we
// just created. Bounded to the orphan rows that exist for this business
// (usually a handful) rather than the number imported, so it stays cheap at
// scale — a fresh contact dump with no past bookings does almost no work.
async function linkImportedOrphans(
  userId: string,
  created: { email: string | null; phone: string | null }[],
) {
  const orphans = await prisma.booking.findMany({
    where: { userId, customerId: null },
    select: { customerEmail: true, customerPhone: true },
  });
  if (orphans.length === 0) return;

  const orphanEmails = new Set(orphans.map((o) => (o.customerEmail || "").toLowerCase()).filter(Boolean));
  const orphanPhones = new Set(orphans.map((o) => normalizePhone(o.customerPhone)).filter(Boolean));

  // The contacts we just inserted that actually correspond to an orphan
  // booking — by email, or by phone digits (formats may differ).
  const relevant = created.filter(
    (c) =>
      (!!c.email && orphanEmails.has(c.email)) ||
      (!!normalizePhone(c.phone) && orphanPhones.has(normalizePhone(c.phone))),
  );
  if (relevant.length === 0) return;

  // Fetch their ids by the exact values we just stored, then let
  // linkOrphanBookings do the normalised matching against the orphan rows.
  const emails = Array.from(new Set(relevant.map((c) => c.email).filter((e): e is string => !!e)));
  const phones = Array.from(new Set(relevant.map((c) => c.phone).filter((p): p is string => !!p)));
  const customers = await prisma.customer.findMany({
    where: {
      userId,
      OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(phones.length ? [{ phone: { in: phones } }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
  });
  for (const c of customers) {
    await linkOrphanBookings(userId, c.id, c.email, c.phone).catch(() => 0);
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({} as any));
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  // Pre-load the existing customers' contact info for fast in-memory dedup.
  const existing = await prisma.customer.findMany({
    where: { userId: session.id },
    select: { email: true, phone: true },
  });
  const emailSet = new Set(existing.map((c) => (c.email || "").toLowerCase()).filter(Boolean));
  const phoneSet = new Set(existing.map((c) => normalizePhone(c.phone)).filter(Boolean));

  let skipped = 0;
  const failures: { row: number; reason: string }[] = [];
  const toCreate: {
    userId: string; firstName: string; lastName: string | null;
    email: string | null; phone: string | null; notes: string | null;
    vehicleMake: string | null; vehicleModel: string | null;
    vehicleYear: string | null; vehicleColor: string | null;
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const firstName = String(r.firstName || "").trim();
    const lastName  = String(r.lastName  || "").trim();
    const email     = String(r.email     || "").trim().toLowerCase();
    const phone     = String(r.phone     || "").trim();

    if (!firstName && !email && !phone) { skipped++; continue; }
    if (!firstName) { failures.push({ row: i + 1, reason: "missing first name" }); continue; }
    if (!email && !phone) { failures.push({ row: i + 1, reason: "needs email or phone" }); continue; }

    // Dedup against existing rows AND earlier rows in this same batch.
    if (email && emailSet.has(email))   { skipped++; continue; }
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone && phoneSet.has(normalizedPhone)) { skipped++; continue; }

    toCreate.push({
      userId: session.id,
      firstName,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      notes: String(r.notes || "").trim() || null,
      vehicleMake: String(r.vehicleMake || "").trim() || null,
      vehicleModel: String(r.vehicleModel || "").trim() || null,
      vehicleYear: String(r.vehicleYear || "").trim() || null,
      vehicleColor: String(r.vehicleColor || "").trim() || null,
    });
    if (email) emailSet.add(email);
    if (normalizedPhone) phoneSet.add(normalizedPhone);
  }

  let imported = 0;
  if (toCreate.length > 0) {
    for (let i = 0; i < toCreate.length; i += INSERT_CHUNK) {
      const res = await prisma.customer.createMany({ data: toCreate.slice(i, i + INSERT_CHUNK) });
      imported += res.count;
    }
    await linkImportedOrphans(session.id, toCreate).catch(() => {});
  }

  return NextResponse.json({ imported, skipped, failures });
}
