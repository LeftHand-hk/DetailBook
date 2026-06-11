import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { linkOrphanBookings } from "@/lib/customer-linking";
import { normalizePhone } from "@/lib/phone";

// GET  /api/customers              — list customers for the logged-in
//                                    business with optional ?search=
// POST /api/customers              — create one (firstName + at least
//                                    one of email/phone required)

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const search = (sp.get("search") || "").trim();
  const sort = sp.get("sort") || "name";

  const where: any = { userId: session.id };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName:  { contains: search, mode: "insensitive" } },
      { email:     { contains: search, mode: "insensitive" } },
      { phone:     { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.customer.findMany({ where });

  // Pull all this business's bookings ONCE and group in JS, so totalBookings
  // and lastBookingDate count BOTH explicitly-linked bookings AND bookings
  // whose email/phone matches the customer record (the FK might be null
  // on rows created before the customer was added). One query, no N+1.
  const allBookings = await prisma.booking.findMany({
    where: { userId: session.id },
    select: { customerId: true, customerEmail: true, customerPhone: true, date: true },
  });

  const list = rows.map((c) => {
    const matchEmail = (c.email || "").toLowerCase();
    const matchPhone = normalizePhone(c.phone);
    const matches = allBookings.filter((b) =>
      b.customerId === c.id
      || (matchEmail && (b.customerEmail || "").toLowerCase() === matchEmail)
      || (matchPhone && normalizePhone(b.customerPhone) === matchPhone)
    );
    const dates = matches.map((m) => m.date).filter(Boolean).sort();
    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      vehicleMake: c.vehicleMake,
      vehicleModel: c.vehicleModel,
      vehicleYear: c.vehicleYear,
      vehicleColor: c.vehicleColor,
      totalBookings: matches.length,
      lastBookingDate: dates.length ? dates[dates.length - 1] : null,
      createdAt: c.createdAt,
    };
  });

  // Sort in JS so we can sort by derived fields.
  list.sort((a, b) => {
    if (sort === "bookings") return b.totalBookings - a.totalBookings;
    if (sort === "last")     return (b.lastBookingDate || "").localeCompare(a.lastBookingDate || "");
    // default — name (case-insensitive)
    const an = `${a.firstName} ${a.lastName || ""}`.toLowerCase();
    const bn = `${b.firstName} ${b.lastName || ""}`.toLowerCase();
    return an.localeCompare(bn);
  });

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({} as any));

  const firstName = String(body.firstName || "").trim();
  if (!firstName) return NextResponse.json({ error: "First name is required" }, { status: 400 });
  const email = String(body.email || "").trim().toLowerCase() || null;
  const phone = String(body.phone || "").trim() || null;
  if (!email && !phone) {
    return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
  }

  const created = await prisma.customer.create({
    data: {
      userId: session.id,
      firstName,
      lastName: String(body.lastName || "").trim() || null,
      email,
      phone,
      notes: String(body.notes || "").trim() || null,
      vehicleMake: String(body.vehicleMake || "").trim() || null,
      vehicleModel: String(body.vehicleModel || "").trim() || null,
      vehicleYear: String(body.vehicleYear || "").trim() || null,
      vehicleColor: String(body.vehicleColor || "").trim() || null,
    },
  });
  // Pull in any pre-existing bookings that match this customer's email
  // or phone so the count is correct from the moment they show up.
  await linkOrphanBookings(session.id, created.id, email, phone).catch(() => 0);
  return NextResponse.json(created, { status: 201 });
}
