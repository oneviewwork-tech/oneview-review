/**
 * Seeds only what the app cannot function without: the two organizations,
 * and a first Admin login to sign in with.
 *
 * It deliberately creates no fake departments or employees — real people
 * come from HR's spreadsheet via `npm run db:import`, and invented ones
 * would be indistinguishable from real records once they were mixed in.
 *
 * Safe to re-run: everything here is an upsert, and an existing admin's
 * password is never overwritten.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORGANIZATIONS = [
  { id: "org_harisco", name: "Haris & Co.", code: "HARISCO" },
  { id: "org_haca", name: "Haris & Co. Academy", code: "HACA" },
];

async function main() {
  for (const org of ORGANIZATIONS) {
    await prisma.organization.upsert({
      where: { code: org.code },
      update: { name: org.name },
      create: org,
    });
  }
  console.log(`Organizations ready: ${ORGANIZATIONS.map((o) => o.code).join(", ")}`);

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@harisand.co").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists — password left untouched.`);
    return;
  }

  if (!password) {
    console.log(
      `\nNo admin created. To create one, set SEED_ADMIN_PASSWORD (and optionally SEED_ADMIN_EMAIL) and re-run:\n` +
        `  SEED_ADMIN_PASSWORD='a-strong-password' npm run db:seed`
    );
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name: process.env.SEED_ADMIN_NAME ?? "Administrator",
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      mustChangePassword: true,
    },
  });
  console.log(`Created admin ${email} (must change password on first login).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
