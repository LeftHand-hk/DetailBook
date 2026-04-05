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

  const result = staff.map(({ password: _, ...s }) => ({
    ...s,
    hasPassword: !!s.bookings, // just to confirm password is hidden
    totalBookings: s.bookings.length,
    completedBookings: s.bookings.filter((b) => b.status === "completed").length,
    totalRevenue: s.bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, b) => sum + b.servicePrice, 0),
    bookingsThisMonth: s.bookings.filter((b) => {
      const month = new Date().toISOString().slice(0, 7);
      return b.date.startsWith(month);
    }).length,
    passwordSet: !!(s as any).password, // flag for UI
  }));

  // Re-add passwordSet from DB since we stripped it
  const staffWithPasswordFlag = await Promise.all(
    result.map(async (s) => {
      const raw = await prisma.staff.findUnique({ where: { id: s.id }, select: { password: true } });
      return { ...s, passwordSet: !!(raw?.password) };
    })
  );

  return NextResponse.json(staffWithPasswordFlag);
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
