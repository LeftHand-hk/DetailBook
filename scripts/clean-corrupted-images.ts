// One-off cleanup: zero out User image columns whose value got
// overwritten with our own "/api/..." placeholder URL. The old GET
// returned a URL string for the logo/banner/cover, the client wrote it
// back via storage.setUser → PUT, and the column was left holding a
// pointer to itself. Affected rows can never serve real bytes again, so
// we set them to NULL and the owner has to re-upload.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const before = await prisma.$queryRaw<Array<{ logo: number; banner: number; cover: number }>>`
    SELECT
      SUM(CASE WHEN logo LIKE '/api/%' THEN 1 ELSE 0 END)::int AS logo,
      SUM(CASE WHEN "bannerImage" LIKE '/api/%' THEN 1 ELSE 0 END)::int AS banner,
      SUM(CASE WHEN "coverImage" LIKE '/api/%' THEN 1 ELSE 0 END)::int AS cover
    FROM "User"`;
  console.log("Corrupted rows before:", before[0]);

  const updated = await prisma.$executeRaw`
    UPDATE "User"
    SET logo = CASE WHEN logo LIKE '/api/%' THEN NULL ELSE logo END,
        "bannerImage" = CASE WHEN "bannerImage" LIKE '/api/%' THEN NULL ELSE "bannerImage" END,
        "coverImage" = CASE WHEN "coverImage" LIKE '/api/%' THEN NULL ELSE "coverImage" END
    WHERE logo LIKE '/api/%' OR "bannerImage" LIKE '/api/%' OR "coverImage" LIKE '/api/%'`;
  console.log(`Cleared corrupted URL placeholders on ${updated} rows.`);

  const affectedUsers = await prisma.$queryRaw<Array<{ email: string; slug: string }>>`
    SELECT email, slug FROM "User"
    WHERE (logo IS NULL OR logo = '')
      AND ("bannerImage" IS NULL OR "bannerImage" = '')
      AND ("coverImage" IS NULL OR "coverImage" = '')
      AND ${0} = 1`; // disabled — kept here for ad-hoc inspection
  if (affectedUsers.length) console.log("Sample users with no images:", affectedUsers.slice(0, 5));
}

main().catch(console.error).finally(() => prisma.$disconnect());
