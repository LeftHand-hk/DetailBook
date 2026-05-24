// Refreshes the demo account's (mike@demo.com) bookings so their dates are
// current again — they were dated months ago and have drifted into the past.
//
// Strategy is status-based so the data stays sensible:
//   • completed bookings → spread across the recent PAST
//   • confirmed / pending → spread across the UPCOMING days
// Times and statuses are preserved; only the date changes.
//
// Usage:
//   npx tsx scripts/demo-bookings-refresh.ts            # inspect only (read-only)
//   npx tsx scripts/demo-bookings-refresh.ts --apply    # write the new dates
//
// Connects to whatever DATABASE_URL points at (production Supabase). Always
// disconnects at the end so we don't leak idle-in-transaction connections.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function dateForOffset(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const pastOffset = (i: number) => -(2 + i * 3); // -2, -5, -8, ...
const futureOffset = (i: number) => 1 + i * 3; //  1,  4,  7, ...

async function main() {
  const apply = process.argv.includes("--apply");

  const user = await prisma.user.findUnique({
    where: { email: "mike@demo.com" },
    select: { id: true, slug: true, businessName: true },
  });
  if (!user) {
    console.log("Demo user mike@demo.com NOT FOUND.");
    return;
  }
  console.log(`Demo user: ${user.businessName} (${user.slug}) — id ${user.id}`);

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: { date: "asc" },
    select: { id: true, customerName: true, serviceName: true, date: true, time: true, status: true },
  });

  console.log(`\nCurrent bookings (${bookings.length}):`);
  for (const b of bookings) {
    console.log(`  ${b.date} ${b.time}  ${b.customerName}  ${b.serviceName}  [${b.status}]`);
  }

  const completed = bookings.filter((b) => b.status === "completed");
  const upcoming = bookings.filter((b) => b.status !== "completed");

  const updates = [
    ...completed.map((b, i) => ({ id: b.id, name: b.customerName, status: b.status, newDate: dateForOffset(pastOffset(i)) })),
    ...upcoming.map((b, i) => ({ id: b.id, name: b.customerName, status: b.status, newDate: dateForOffset(futureOffset(i)) })),
  ];

  console.log(`\nPlanned new dates:`);
  for (const u of [...updates].sort((a, b) => a.newDate.localeCompare(b.newDate))) {
    console.log(`  ${u.newDate}  ${u.name}  [${u.status}]`);
  }

  if (!apply) {
    console.log("\n(dry run — re-run with --apply to write these changes)");
    return;
  }

  for (const u of updates) {
    await prisma.booking.update({ where: { id: u.id }, data: { date: u.newDate } });
  }
  console.log(`\n✅ Updated ${updates.length} demo bookings.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
