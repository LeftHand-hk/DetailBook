// One-shot diagnostic for the booking-page save 504.
// Times the EXACT operations the editor performs, against the real DB, so we
// know whether the timeout lives in the database/pooler or in the Netlify
// function layer. Writes back the SAME value it reads, so nothing changes.
import "dotenv/config";
import prisma from "../lib/prisma";

const ms = (start: number) => `${(performance.now() - start).toFixed(0)}ms`;

async function main() {
  console.log("DATABASE_URL host:", new URL(process.env.DATABASE_URL!).host);

  let t = performance.now();
  const user = await prisma.user.findFirst({ select: { id: true, slug: true, bookingPageLayout: true } });
  console.log(`[1] cold connect + findFirst: ${ms(t)}`, user ? `(user ${user.slug})` : "(NO USERS)");
  if (!user) return;

  t = performance.now();
  await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, slug: true, bookingPageLayout: true, serviceLayout: true, accentColor: true },
  });
  console.log(`[2] GET findUnique (warm): ${ms(t)}`);

  t = performance.now();
  await prisma.$queryRaw`SELECT (CASE WHEN logo LIKE 'http%' THEN logo END) AS "logoUrl",
    (logo IS NOT NULL AND logo <> '') AS "hasLogo" FROM "User" WHERE id = ${user.id}`;
  console.log(`[3] GET image $queryRaw: ${ms(t)}`);

  // The exact save the editor does — write the SAME layout back (no-op change).
  t = performance.now();
  await prisma.user.update({
    where: { id: user.id },
    data: { bookingPageLayout: user.bookingPageLayout },
    select: { bookingPageLayout: true },
  });
  console.log(`[4] PATCH user.update (the save): ${ms(t)}`);

  // Three rapid saves in a row — mimics fast typing / concurrent autosaves.
  t = performance.now();
  await Promise.all([0, 1, 2].map(() =>
    prisma.user.update({ where: { id: user.id }, data: { bookingPageLayout: user.bookingPageLayout }, select: { id: true } })
  ));
  console.log(`[5] 3 concurrent saves: ${ms(t)}`);
}

main()
  .then(() => { console.log("DONE — db is reachable and these are the real latencies."); })
  .catch((e) => { console.error("FAILED:", e?.code || "", e?.message || e); })
  .finally(async () => { await prisma.$disconnect(); process.exit(0); });
