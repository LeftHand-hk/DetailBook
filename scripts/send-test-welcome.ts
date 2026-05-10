// One-off: send all 4 welcome emails to the founder's address so we can
// confirm formatting in a real inbox. Uses overrideTo so it does not
// affect any user's tracking.
//
// Usage:  npx tsx scripts/send-test-welcome.ts <email>
// Default recipient: mail.arditzogiani@gmail.com

import "dotenv/config";
import prisma from "../lib/prisma";
import { sendWelcomeEmail, type WelcomeEmailKey } from "../lib/welcome-emails";

const recipient = process.argv[2] || "mail.arditzogiani@gmail.com";

async function main() {
  const sample = await prisma.user.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, businessName: true },
  });
  if (!sample) {
    console.error("No users in DB to use as template source.");
    process.exit(1);
  }
  console.log(`Using sample user: ${sample.email} (${sample.businessName})`);
  console.log(`Sending all 4 welcome emails to ${recipient}...`);

  const keys: WelcomeEmailKey[] = ["day0", "day2", "day5", "day13"];
  for (const key of keys) {
    const result = await sendWelcomeEmail(sample.id, key, { overrideTo: recipient });
    if (result.success) {
      console.log(`  ✓ ${key} sent`);
    } else {
      console.log(`  ✗ ${key} failed: ${result.error}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
