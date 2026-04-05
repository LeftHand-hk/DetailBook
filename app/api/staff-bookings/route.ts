import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";

// GET — staff sees only their own bookings
export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    where: { staffId: session.id },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  return NextResponse.json(bookings);
}

// PATCH — staff can update status only (not price, not service)
export async function PATCH(req: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId, status, notes } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const allowed = ["confirmed", "completed", "in_progress"];
  if (status && !allowed.includes(status)) {
    return NextResponse.json({ error: "You can only set: confirmed, in_progress, completed" }, { status: 403 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.staffId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(updated);
}
