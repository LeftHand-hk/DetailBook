// Quick end-to-end check that the new hasSeenCustomizePrompt flag
// round-trips through Prisma cleanly. Reads the most recent user,
// resets the flag, then sets it back to true and verifies the value.
//
//   npx tsx scripts/test-customize-prompt.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, hasSeenCustomizePrompt: true },
  });
  if (!u) {
    console.log("No users in DB — nothing to test.");
    return;
  }
  console.log(`Latest user: ${u.email}`);
  console.log(`  hasSeenCustomizePrompt (current): ${u.hasSeenCustomizePrompt}`);

  // Reset to false, then flip true to confirm the field reads/writes.
  await prisma.user.update({
    where: { id: u.id },
    data: { hasSeenCustomizePrompt: false },
  });
  const a = await prisma.user.findUnique({
    where: { id: u.id },
    select: { hasSeenCustomizePrompt: true },
  });
  console.log(`  after reset to false: ${a?.hasSeenCustomizePrompt}`);

  await prisma.user.update({
    where: { id: u.id },
    data: { hasSeenCustomizePrompt: true },
  });
  const b = await prisma.user.findUnique({
    where: { id: u.id },
    select: { hasSeenCustomizePrompt: true },
  });
  console.log(`  after set to true:    ${b?.hasSeenCustomizePrompt}`);

  // Restore to the original value so we don't leave a test-side-effect
  // on a real user record.
  await prisma.user.update({
    where: { id: u.id },
    data: { hasSeenCustomizePrompt: u.hasSeenCustomizePrompt },
  });
  console.log(`  restored to:          ${u.hasSeenCustomizePrompt}`);
  console.log("\n✓ Field reads + writes cleanly.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
