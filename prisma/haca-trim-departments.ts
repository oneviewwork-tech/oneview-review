/**
 * Removes every HACA department outside the six actually in use for
 * reviews (SHO, Sales, Placement, Academics, Design School, Tech School).
 * The rest came from the HRMS import's per-row DEPARTMENT column, which is
 * far more granular than the review structure you actually run — this
 * trims it down to that.
 *
 * Safety-checked before writing: as of running this, zero submissions
 * reference any employee or login being removed. If that stops being true
 * later, re-run the check in prisma/haca-submitters.ts's spirit before
 * running this again — it is not re-checked automatically.
 *
 * Logins scoped to a removed department are deleted first (a department
 * can't be deleted while a login still points at it), then the employees,
 * then the department itself.
 *
 * Run with:  npx tsx prisma/haca-trim-departments.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEEP_CODES = ["SHO", "SALES", "PLACEMENT", "ACADEMICS", "DESIGN_SCHOOL", "TECH_SCHOOL"];

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { code: "HACA" } });

  const toRemove = await prisma.department.findMany({
    where: { organizationId: org.id, code: { notIn: KEEP_CODES } },
    include: { _count: { select: { employees: true, users: true } } },
  });

  if (toRemove.length === 0) {
    console.log("Nothing to remove — HACA already only has the six kept departments.");
    return;
  }

  console.log(`Removing ${toRemove.length} department(s):`);
  for (const d of toRemove) {
    console.log(`  ${d.name} — ${d._count.employees} employee(s), ${d._count.users} login(s)`);
  }

  const ids = toRemove.map((d) => d.id);

  const users = await prisma.user.deleteMany({ where: { departmentId: { in: ids } } });
  const employees = await prisma.employee.deleteMany({ where: { departmentId: { in: ids } } });
  const departments = await prisma.department.deleteMany({ where: { id: { in: ids } } });

  console.log(`\nDeleted ${departments.count} department(s), ${employees.count} employee(s), ${users.count} login(s).`);

  const remaining = await prisma.department.findMany({
    where: { organizationId: org.id },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  console.log("\nHACA departments now:", remaining.map((d) => d.name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
