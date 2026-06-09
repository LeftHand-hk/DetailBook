import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// POST /api/customers/import
// Body: { rows: Array<{ firstName, lastName?, email?, phone?, ... }> }
// Dedup rule: same userId AND same non-empty email → skip. Otherwise
// upsert by phone (same userId AND same non-empty phone) → skip.
// Empty rows (no firstName + no email + no phone) are silently dropped.

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({} as any));
  const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  // Pre-load the existing customers' contact info for fast dedup checks.
  const existing = await prisma.customer.findMany({
    where: { userId: session.id },
    select: { email: true, phone: true },
  });
  const emailSet = new Set(existing.map((c) => (c.email || "").toLowerCase()).filter(Boolean));
  const phoneSet = new Set(existing.map((c) => (c.phone || "").trim()).filter(Boolean));

  let imported = 0;
  let skipped = 0;
  const failures: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const firstName = String(r.firstName || "").trim();
    const lastName  = String(r.lastName  || "").trim();
    const email     = String(r.email     || "").trim().toLowerCase();
    const phone     = String(r.phone     || "").trim();

    if (!firstName && !email && !phone) { skipped++; continue; }
    if (!firstName) { failures.push({ row: i + 1, reason: "missing first name" }); continue; }
    if (!email && !phone) { failures.push({ row: i + 1, reason: "needs email or phone" }); continue; }

    if (email && emailSet.has(email))   { skipped++; continue; }
    if (phone && phoneSet.has(phone))   { skipped++; continue; }

    await prisma.customer.create({
      data: {
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
      },
    });
    if (email) emailSet.add(email);
    if (phone) phoneSet.add(phone);
    imported++;
  }

  return NextResponse.json({ imported, skipped, failures });
}
