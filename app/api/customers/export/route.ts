import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { buildCustomerMetrics } from "@/lib/customer-metrics";

// GET /api/customers/export — full customer list as CSV. Columns:
// First Name, Last Name, Email, Phone, Total Bookings, Total Spent,
// Last Booking Date, Last Service

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
    orderBy: { firstName: "asc" },
  });
  const bookings = await prisma.booking.findMany({
    where: { userId: session.id },
    select: {
      id: true, customerId: true, customerEmail: true, customerPhone: true,
      date: true, serviceName: true, servicePrice: true, addonsTotal: true,
      status: true, createdAt: true,
    },
  });
  const metrics = buildCustomerMetrics(rows, bookings);

  const header = ["First Name", "Last Name", "Email", "Phone", "Total Bookings", "Total Spent", "Last Booking Date", "Last Service"];
  const lines = [header.map(csvField).join(",")];
  for (const c of rows) {
    const metric = metrics.get(c.id)!;
    lines.push([
      c.firstName,
      c.lastName || "",
      c.email || "",
      c.phone || "",
      metric.totalBookings,
      metric.totalSpent,
      metric.lastBookingDate || "",
      metric.lastService || "",
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
