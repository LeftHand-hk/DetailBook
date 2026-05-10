/**
 * One-shot backfill for the new welcome-email tracking columns.
 *
 * Run once after `npm run db:push` adds the new columns. Idempotent —
 * re-running it is safe (rows with all four *At columns already set are
 * skipped).
 *
 * Spec: "DO NOT bulk-send retroactive emails. Only send emails based on
 * their natural signup date going forward."
 *
 * So for every pre-existing user we mark Day 0 / Day 2 / Day 5 as
 * already-handled (using their createdAt as a reasonable proxy
 * timestamp) so the cron never re-fires those. Day 13 stays null only
 * for users who:
 *   a) didn't already receive the legacy email 3 (welcomeEmailsSent < 3)
 *   b) are still within the 30-day window where cron looks
 * Everyone else gets Day 13 marked as done too.
 *
 *   npx tsx scripts/backfill-welcome-emails.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { welcomeEmailDay0At: null },
        { welcomeEmailDay2At: null },
        { welcomeEmailDay5At: null },
        { welcomeEmailDay13At: null },
      ],
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      welcomeEmailsSent: true,
      welcomeEmailLastSentAt: true,
      welcomeEmailDay0At: true,
      welcomeEmailDay2At: true,
      welcomeEmailDay5At: true,
      welcomeEmailDay13At: true,
    },
  });

  console.log(`Found ${users.length} user(s) needing backfill.`);

  const now = new Date();
  let updated = 0;
  let day13StillDue = 0;

  for (const user of users) {
    const ageDays = (now.getTime() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    const updates: Record<string, unknown> = {};

    if (!user.welcomeEmailDay0At) {
      updates.welcomeEmailDay0At = user.createdAt;
    }
    if (!user.welcomeEmailDay2At) {
      // Day 2 didn't exist in the old sequence, mark as "skipped" so
      // there's an audit trail explaining why this user never got it.
      updates.welcomeEmailDay2At = user.createdAt;
      updates.welcomeEmailDay2Skipped = true;
    }
    if (!user.welcomeEmailDay5At) {
      updates.welcomeEmailDay5At = user.createdAt;
    }
    if (!user.welcomeEmailDay13At) {
      if (user.welcomeEmailsSent >= 3) {
        // Already received the legacy "email 3" which IS the Day 13.
        updates.welcomeEmailDay13At = user.welcomeEmailLastSentAt || user.createdAt;
      } else if (ageDays > 30) {
        // Outside the cron's 30-day scan window — close it off so we
        // don't ever surprise-send.
        updates.welcomeEmailDay13At = user.createdAt;
      } else {
        // Leave Day 13 null. They'll get it via cron when they hit
        // Day 13 from their signup. Per spec: this is OK.
        day13StillDue += 1;
      }
    }

    if (Object.keys(updates).length === 0) continue;
    await prisma.user.update({ where: { id: user.id }, data: updates });
    updated += 1;
    console.log(`  ✓ ${user.email} (age ${ageDays.toFixed(1)}d, legacy sent=${user.welcomeEmailsSent})`);
  }

  console.log(`\nBackfilled ${updated} user(s).`);
  console.log(`Day 13 still due (will fire from cron when age ≥ 13): ${day13StillDue}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
