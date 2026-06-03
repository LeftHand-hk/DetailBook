// Find users that may have been charged on day 0 instead of getting their
// 7-day trial because the webhook hit the "no fromOnboarding → activate
// immediately" branch. Heuristic: signed up in the last 30 days AND
// subscriptionStatus is already "active" (i.e. charged) when they should
// still be in "trialing".
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.user.findMany({
    where: {
      createdAt: { gte: since },
      subscriptionStatus: "active",
      NOT: { paddleSubscriptionId: null },
    },
    select: {
      email: true,
      createdAt: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      paddleSubscriptionId: true,
      paddleCustomerId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${rows.length} accounts with status="active" in last 30 days:\n`);
  for (const r of rows) {
    const ageMin = Math.floor((Date.now() - r.createdAt.getTime()) / 60000);
    const ageDays = (ageMin / 60 / 24).toFixed(1);
    console.log(
      `  ${r.createdAt.toISOString().slice(0, 10)}  ${ageDays}d ago  trialEndsAt="${r.trialEndsAt || ""}"  sub=${r.paddleSubscriptionId?.slice(0, 14)}…  ${r.email}`,
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
