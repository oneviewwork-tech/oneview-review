/**
 * Removes the demo/seed data so only real HR data remains.
 *
 * Demo records are identified by their @company.com addresses, which the
 * seed script invented and which no real person uses.
 *
 * The two demo *logins* (admin@company.com, hr@company.com) are deliberately
 * kept: deleting them before real users exist would lock everyone out of the
 * deployed app. Remove them from Admin > Users once real accounts are in.
 *
 * Run with:  npm run db:cleanup-demo
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_DOMAIN = "@company.com";
const KEEP_LOGINS = ["admin@company.com", "hr@company.com"];

async function main() {
  const demoEmployees = await prisma.employee.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true, name: true },
  });
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN }, NOT: { email: { in: KEEP_LOGINS } } },
    select: { id: true, email: true },
  });
  const demoEmployeeIds = demoEmployees.map((e) => e.id);
  const demoUserIds = demoUsers.map((u) => u.id);

  console.log(`Found ${demoEmployees.length} demo employee(s) and ${demoUsers.length} removable demo login(s).`);

  // Order matters: submissions reference employees and users, and audit
  // events reference users, so the leaves go first.
  const submissions = await prisma.feedbackSubmission.deleteMany({
    where: {
      OR: [
        { employeeId: { in: demoEmployeeIds } },
        { departmentHeadId: { in: demoUserIds } },
      ],
    },
  });
  console.log(`Deleted ${submissions.count} demo submission(s).`);

  const audits = await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: demoUserIds } } });
  console.log(`Deleted ${audits.count} audit event(s) belonging to removed logins.`);

  const employees = await prisma.employee.deleteMany({ where: { id: { in: demoEmployeeIds } } });
  console.log(`Deleted ${employees.count} demo employee(s).`);

  const users = await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  console.log(`Deleted ${users.count} demo login(s).`);

  // Any department left with nothing in it is a leftover of the demo seed.
  const empty = await prisma.department.findMany({
    where: { employees: { none: {} }, submissions: { none: {} }, users: { none: {} } },
    select: { id: true, name: true, code: true },
  });
  if (empty.length) {
    await prisma.department.deleteMany({ where: { id: { in: empty.map((d) => d.id) } } });
    console.log(`Deleted ${empty.length} empty department(s): ${empty.map((d) => `${d.name} [${d.code}]`).join(", ")}`);
  }

  const remaining = await prisma.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } }, select: { email: true } });
  if (remaining.length) {
    console.log(`\nKept ${remaining.length} demo login(s) so you are not locked out: ${remaining.map((u) => u.email).join(", ")}`);
    console.log("Delete them from Admin > Users once real accounts exist.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
