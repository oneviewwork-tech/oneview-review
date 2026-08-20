/**
 * Clears every feedback submission — the review pipeline and Email History —
 * so a cycle can start from nothing.
 *
 * Deliberately narrow: employees, users, departments and organizations are
 * master data and are never touched. Only submissions, and the audit rows
 * that describe them, are removed.
 *
 * The audit trail is otherwise append-only. Removing submission audit rows
 * is a documented exception for wiping test data before real use: leaving
 * them would mean the log references submissions that no longer exist.
 * Login/logout and admin audit rows are preserved.
 *
 * Run with:  npm run db:reset-submissions
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const submissions = await prisma.feedbackSubmission.findMany({
    select: { status: true, employeeName: true, employeeEmail: true },
    orderBy: { createdAt: "asc" },
  });

  if (submissions.length === 0) {
    console.log("No submissions to remove — nothing to do.");
    return;
  }

  console.log(`Removing ${submissions.length} submission(s):`);
  for (const s of submissions) {
    console.log(`  [${s.status}] ${s.employeeName} <${s.employeeEmail}>`);
  }

  const audits = await prisma.auditEvent.deleteMany({ where: { entityType: "FeedbackSubmission" } });
  const removed = await prisma.feedbackSubmission.deleteMany({});

  console.log(`\nDeleted ${removed.count} submission(s) and ${audits.count} related audit event(s).`);

  const [employees, users, departments] = await Promise.all([
    prisma.employee.count(),
    prisma.user.count(),
    prisma.department.count(),
  ]);
  console.log(`Untouched — employees: ${employees}, users: ${users}, departments: ${departments}`);
  console.log("Overview counters, Submissions and Email History are now empty.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
