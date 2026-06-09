import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// GET   /api/customers/[id]  — single customer + booking history + total spent
// PATCH /api/customers/[id]  — update any editable field
// DELETE /api/customers/[id] — remove (Booking.customerId is SetNull, so
//                               bookings keep their data, just unlinked)

const EDITABLE = new Set([
  "firstName", "lastName", "email", "phone", "notes",
  "vehicleMake", "vehicleModel", "vehicleYear", "vehicleColor",
]);

async function ownedCustomer(id: string, userId: string) {
  return prisma.customer.findFirst({ where: { id, userId } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const customer = await ownedCustomer(id, session.id);
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bookings = await prisma.booking.findMany({
    where: { userId: session.id, customerId: id },
    orderBy: { date: "desc" },
    select: {
      id: true, date: true, time: true,
      serviceName: true, servicePrice: true,
      addonsTotal: true, depositPaid: true, depositRequired: true,
      status: true, createdAt: true,
    },
  });

  const totalSpent = bookings
    .filter((b) => b.status === "completed")
    .reduce((s, b) => s + (b.servicePrice || 0) + (b.addonsTotal || 0), 0);

  return NextResponse.json({ customer, bookings, totalSpent });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedCustomer(id, session.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({} as any));
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!EDITABLE.has(k)) continue;
    if (typeof v === "string") {
      const cleaned = v.trim();
      if (k === "email") data.email = cleaned ? cleaned.toLowerCase() : null;
      else if (k === "firstName") {
        if (!cleaned) continue; // required — don't blank it
        data.firstName = cleaned;
      } else {
        data[k] = cleaned || null;
      }
    } else if (v === null) {
      data[k] = null;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const updated = await prisma.customer.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await ownedCustomer(id, session.id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
