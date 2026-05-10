import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { sendWelcomeEmail } from "../lib/welcome-emails";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "mail.arditzogiani@gmail.com";
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!u) {
    console.log(`No user with email ${email}`);
    return;
  }
  const r = await sendWelcomeEmail(u.id, "day0", { forceResend: true });
  console.log("Result:", r);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
