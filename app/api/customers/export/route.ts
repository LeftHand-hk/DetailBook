import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// GET /api/customers/export — full customer list as CSV. Columns:
// First Name, Last Name, Email, Phone, Total Bookings, Last Booking Date

function csvField(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.customer.findMany({
    where: { userId: session.id },
    include: {
      _count: { select: { bookings: true } },
      bookings: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
    orderBy: { firstName: "asc" },
  });

  const header = ["First Name", "Last Name", "Email", "Phone", "Total Bookings", "Last Booking Date"];
  const lines = [header.map(csvField).join(",")];
  for (const c of rows) {
    lines.push([
      c.firstName,
      c.lastName || "",
      c.email || "",
      c.phone || "",
      c._count.bookings,
      c.bookings[0]?.date || "",
    ].map(csvField).join(","));
  }
  const csv = lines.join("\r\n");

  const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
