import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";

// GET /api/staff — list all staff with booking stats
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staff = await prisma.staff.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "asc" },
    include: {
      bookings: { select: { status: true, servicePrice: true, date: true } },
    },
  });

  const month = new Date().toISOString().slice(0, 7);
  const result = staff.map(({ password, bookings, ...s }) => ({
    ...s,
    totalBookings: bookings.length,
    completedBookings: bookings.filter((b) => b.status === "completed").length,
    totalRevenue: bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + b.servicePrice, 0),
    bookingsThisMonth: bookings.filter((b) => b.date.startsWith(month)).length,
    passwordSet: Boolean(password),
  }));

  return NextResponse.json(result);
}

// POST /api/staff — create a new staff member
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.plan !== "pro") return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json();
  const { name, email, phone, role, color, avatar, password } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const hashedPassword = password ? await hashPassword(password) : "";

  const staff = await prisma.staff.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      phone: phone || "",
      role: role || "detailer",
      color: color || "#3B82F6",
      avatar: avatar || null,
      password: hashedPassword,
      userId: session.id,
    },
  });

  const { password: _, ...staffData } = staff;
  return NextResponse.json({ ...staffData, passwordSet: !!hashedPassword }, { status: 201 });
}
