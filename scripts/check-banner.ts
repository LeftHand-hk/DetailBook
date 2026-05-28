import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({
    where: { slug: "mikes-mobile-detailing" },
    select: { id: true, slug: true, businessName: true },
  });
  if (!u) { console.log("user not found"); return; }

  // Use raw query to see the actual prefix of each base64 column without
  // pulling the whole multi-MB blob across the wire.
  const rows = await prisma.$queryRaw<Array<{
    logo_len: number; logo_head: string | null;
    banner_len: number; banner_head: string | null;
    cover_len: number; cover_head: string | null;
  }>>`
    SELECT
      COALESCE(LENGTH(logo), 0)         AS logo_len,
      LEFT(logo, 60)                    AS logo_head,
      COALESCE(LENGTH("bannerImage"),0) AS banner_len,
      LEFT("bannerImage", 60)           AS banner_head,
      COALESCE(LENGTH("coverImage"),0)  AS cover_len,
      LEFT("coverImage", 60)            AS cover_head
    FROM "User" WHERE id = ${u.id}`;
  console.log(JSON.stringify(rows[0], (k, v) => typeof v === "bigint" ? Number(v) : v, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
