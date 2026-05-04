// One-off: send all 3 welcome emails to the founder's address so we can
// confirm formatting in a real inbox. Uses overrideTo so it does not
// affect any user's tracking.
//
// Usage:  npx tsx scripts/send-test-welcome.mts <email>
// Default recipient: mail.arditzogiani@gmail.com

import "dotenv/config";
import prisma from "../lib/prisma";
import { sendWelcomeEmail } from "../lib/welcome-emails";

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
  console.log(`Sending all 3 welcome emails to ${recipient}...`);

  for (const num of [1, 2, 3] as const) {
    const result = await sendWelcomeEmail(sample.id, num, { overrideTo: recipient });
    if (result.success) {
      console.log(`  ✓ #${num} sent`);
    } else {
      console.log(`  ✗ #${num} failed: ${result.error}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
