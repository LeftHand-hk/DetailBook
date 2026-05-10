import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Latest 30 EmailLog rows so we can see what fired and to whom.
  const logs = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { email: true, businessName: true } } },
  });
  console.log("=== Latest EmailLog rows ===");
  for (const l of logs) {
    console.log(
      `[${l.createdAt.toISOString()}] ${l.emailType} → ${l.recipient}` +
      ` attempt=${l.attempt} success=${l.success}` +
      (l.errorMessage ? ` err=${l.errorMessage}` : "") +
      (l.user ? ` user=${l.user.email}` : "")
    );
  }

  // Most recent 5 users with their welcome email tracking columns.
  const recent = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      email: true,
      createdAt: true,
      welcomeEmailDay0At: true,
      welcomeEmailDay2At: true,
      welcomeEmailDay2Skipped: true,
      welcomeEmailDay5At: true,
      welcomeEmailDay13At: true,
      welcomeEmailsSent: true,
    },
  });
  console.log("\n=== 5 most recent users ===");
  for (const u of recent) {
    console.log(JSON.stringify(u, null, 2));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
