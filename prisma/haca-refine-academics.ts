/**
 * Narrows Tech School, Design School and Placement down to the specific
 * people named for review, and moves Neha and Rashid — the two submitters
 * — into Academics as Saheel's reports, per an explicit correction.
 *
 * Everyone dropped from a department's target list is deactivated in
 * place (isActive=false, department unchanged), not deleted: it's the
 * least destructive reversible option, and avoids guessing which other
 * department a real person actually belongs to.
 *
 * Four names given for Tech School — Hanna, Nidhin, Safva, Abishna —
 * match no existing employee under any name, and email (the required
 * unique identity here) wasn't given for them, so they are reported and
 * skipped rather than invented.
 *
 * Run with:  npx tsx prisma/haca-refine-academics.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Emails, not names, drive every match — names are inconsistently cased
// and sometimes shortened across the sheets.
const TECH_SCHOOL_KEEP = ["hamnak@harisandcoacademy.com", "radhikaek@harisandcoacademy.com", "rasmina@harisandcoacademy.com"];
const DESIGN_SCHOOL_KEEP = ["sahada@harisandcoacademy.com", "zulal@harisandcoacademy.com", "mr.ishamzubair@gmail.com", "nijin@harisandcoacademy.com"];
const PLACEMENT_KEEP = ["ayshanadha@harisandcoacademy.com"];

const MOVE_TO_ACADEMICS = ["neha@harisandcoacademy.com", "arhan@harisandcoacademy.com"]; // Neha, Mohammed Rashid. A

const MISSING_NO_EMAIL = ["Hanna", "Nidhin", "Safva", "Abishna"];

async function narrowDepartment(orgId: string, code: string, keepEmails: string[]) {
  const dept = await prisma.department.findUniqueOrThrow({ where: { organizationId_code: { organizationId: orgId, code } } });
  const all = await prisma.employee.findMany({ where: { departmentId: dept.id, isActive: true } });
  const drop = all.filter((e) => !keepEmails.includes(e.email) && !MOVE_TO_ACADEMICS.includes(e.email));

  if (drop.length) {
    await prisma.employee.updateMany({ where: { id: { in: drop.map((e) => e.id) } }, data: { isActive: false } });
  }
  return { department: dept.name, kept: all.filter((e) => keepEmails.includes(e.email)), deactivated: drop };
}

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { code: "HACA" } });
  const academics = await prisma.department.findUniqueOrThrow({
    where: { organizationId_code: { organizationId: org.id, code: "ACADEMICS" } },
  });

  const moved = await prisma.employee.findMany({ where: { email: { in: MOVE_TO_ACADEMICS } } });
  await prisma.employee.updateMany({
    where: { email: { in: MOVE_TO_ACADEMICS } },
    data: { departmentId: academics.id },
  });

  const results = await Promise.all([
    narrowDepartment(org.id, "TECH_SCHOOL", TECH_SCHOOL_KEEP),
    narrowDepartment(org.id, "DESIGN_SCHOOL", DESIGN_SCHOOL_KEEP),
    narrowDepartment(org.id, "PLACEMENT", PLACEMENT_KEEP),
  ]);

  console.log(`Moved to Academics: ${moved.map((e) => e.name).join(", ") || "none"}\n`);

  for (const r of results) {
    console.log(`${r.department}:`);
    console.log(`  kept active: ${r.kept.map((e) => e.name).join(", ") || "none"}`);
    console.log(`  deactivated: ${r.deactivated.map((e) => e.name).join(", ") || "none"}`);
  }

  console.log(`\nNo match, no email given — not created: ${MISSING_NO_EMAIL.join(", ")}`);
  console.log("Send their email addresses and I'll add them to Tech School.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
