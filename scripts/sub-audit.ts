import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.user.findMany({
    select: {
      email: true, subscriptionStatus: true, suspended: true,
      trialEndsAt: true, paddleSubscriptionId: true, paddleCustomerId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Breakdown by status
  const byStatus: Record<string, number> = {};
  let withSub = 0, withCustomer = 0;
  for (const u of all) {
    const s = u.subscriptionStatus || "(none)";
    byStatus[s] = (byStatus[s] || 0) + 1;
    if (u.paddleSubscriptionId) withSub++;
    if (u.paddleCustomerId) withCustomer++;
  }

  console.log(`Total accounts: ${all.length}`);
  console.log(`Have paddleSubscriptionId: ${withSub}`);
  console.log(`Have paddleCustomerId: ${withCustomer}`);
  console.log(`\nStatus breakdown:`);
  for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }

  console.log(`\nLast 12 accounts:`);
  for (const u of all.slice(0, 12)) {
    console.log(
      `  ${u.createdAt.toISOString().slice(0, 10)}  ${(u.subscriptionStatus || "(none)").padEnd(11)}` +
      ` susp=${u.suspended ? "Y" : "n"} sub=${u.paddleSubscriptionId ? "Y" : "n"} cust=${u.paddleCustomerId ? "Y" : "n"}  ${u.email}`
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
