import { PrismaClient } from "@prisma/client";

// One-off: allow the publishable/anon key to upload to (and read from) the
// public `images` bucket. Mirrors what the Supabase dashboard's policy
// editor does. Run: npx tsx --env-file=.env scripts/setup-storage-policy.ts
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

const stmts = [
  `DROP POLICY IF EXISTS "anon_insert_images" ON storage.objects`,
  `CREATE POLICY "anon_insert_images" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'images')`,
  `DROP POLICY IF EXISTS "anon_update_images" ON storage.objects`,
  `CREATE POLICY "anon_update_images" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'images') WITH CHECK (bucket_id = 'images')`,
  `DROP POLICY IF EXISTS "public_read_images" ON storage.objects`,
  `CREATE POLICY "public_read_images" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'images')`,
];

async function main() {
  for (const s of stmts) {
    try {
      await prisma.$executeRawUnsafe(s);
      console.log("OK  ", s.slice(0, 70));
    } catch (e) {
      console.error("ERR ", s.slice(0, 70), "->", (e as Error)?.message?.split("\n")[0]);
    }
  }
}

main().finally(() => prisma.$disconnect());
