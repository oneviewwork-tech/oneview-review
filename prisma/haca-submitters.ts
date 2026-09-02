/**
 * Creates the real Team Lead logins for HACA, from the submitter list you
 * gave directly (name + email + department) rather than inferred from a
 * job title — the automatic detection in import-hrms.ts had already guessed
 * wrong for Tech School and Design School, and had no way to know about
 * people who submit but aren't in the HRMS sheet at all (Jaseela, Saheel).
 *
 * A department can have more than one Team Lead — Sales gets six here —
 * since the schema scopes a login to a department, not to a single person
 * per department.
 *
 * Two people (Rashid, Gayathri) already exist as Employees under a
 * different address than the one given for their login; per your call,
 * the login uses the address you gave and the Employee record is left as
 * it was imported — the two are independent records and nothing requires
 * them to match.
 *
 * Two people (Jaseela, Saheel) are login-only: they can submit feedback
 * for their department but are not themselves in the reviewable employee
 * list, since they weren't in the HRMS import at all.
 *
 * Re-running is safe: an existing login is left untouched, matched on
 * email.
 *
 * Run with:  npx tsx prisma/haca-submitters.ts
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Submitter {
  name: string;
  email: string;
  departmentCode: string;
}

const SUBMITTERS: Submitter[] = [
  { name: "Monisha", email: "monisha@harisandcoacademy.com", departmentCode: "SHO" },
  { name: "Anju Shaji", email: "anjushaji@harisandcoacademy.com", departmentCode: "SALES" },
  { name: "Deepa P C", email: "deepa@harisandcoacademy.com", departmentCode: "SALES" },
  { name: "Mohammed Ameen", email: "ameen@harisandcoacademy.com", departmentCode: "SALES" },
  { name: "Lithiya", email: "lithiya@harisandcoacademy.com", departmentCode: "SALES" },
  { name: "Jaseela", email: "jaseela@harisandcoacademy.com", departmentCode: "SALES" },
  // Manu Mohan M (manu@...) is omitted: already a Sales Team Lead from the
  // earlier import (auto-detected as "Head of Sales").
  { name: "Neha", email: "neha@harisandcoacademy.com", departmentCode: "TECH_SCHOOL" },
  { name: "Rashid", email: "rashid@harisandcoacademy.com", departmentCode: "DESIGN_SCHOOL" },
  { name: "Gayathri", email: "gayathri@harisandcoacademy.com", departmentCode: "PLACEMENT" },
  // No existing department covers general Academics (Tech School and
  // Design School already split off on their own) — created below.
  { name: "Saheel", email: "saheel@harisandcoacademy.com", departmentCode: "ACADEMICS" },
];

function tempPassword(): string {
  return crypto.randomBytes(9).toString("base64url") + "!1";
}

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { code: "HACA" } });

  await prisma.department.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "ACADEMICS" } },
    update: {},
    create: { organizationId: org.id, name: "Academics", code: "ACADEMICS" },
  });

  const created: { name: string; email: string; department: string; password: string }[] = [];
  const skipped: { name: string; email: string; reason: string }[] = [];

  for (const s of SUBMITTERS) {
    const department = await prisma.department.findUnique({
      where: { organizationId_code: { organizationId: org.id, code: s.departmentCode } },
    });
    if (!department) {
      skipped.push({ name: s.name, email: s.email, reason: `no department with code ${s.departmentCode}` });
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (existing) {
      skipped.push({ name: s.name, email: s.email, reason: "login already exists, left untouched" });
      continue;
    }

    const password = tempPassword();
    await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "DEPARTMENT_HEAD",
        departmentId: department.id,
        mustChangePassword: true,
      },
    });
    created.push({ name: s.name, email: s.email, department: department.name, password });
  }

  if (created.length) {
    console.log(`Created ${created.length} Team Lead login(s):\n`);
    for (const c of created) {
      console.log(`  ${c.name.padEnd(20)} ${c.email.padEnd(32)} ${c.department.padEnd(14)} password: ${c.password}`);
    }
    console.log("\n  Passwords are shown once and must be changed on first login.");
  }
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const s of skipped) console.log(`  ${s.name} <${s.email}> — ${s.reason}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
