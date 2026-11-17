/**
 * One-off: copies Review's existing data from the old Neon database into the
 * `review` schema of People's Supabase database.
 *
 * READ side  : Neon (the commented `# NEON_DIRECT_URL` line in .env, or
 *              SOURCE_DATABASE_URL). Only ever SELECTed from.
 * WRITE side : DIRECT_URL from .env, which must carry `schema=review`. The
 *              script refuses to run otherwise, so it cannot write into
 *              People's `public` tables.
 *
 * Dry run by default — it prints what it would copy and which people have no
 * People account. Nothing is written without `--apply`.
 *
 *   npx tsx prisma/copy-from-neon.ts            # dry run
 *   npx tsx prisma/copy-from-neon.ts --apply    # copy
 *
 * Safe to re-run: ids are preserved and rows that already exist are skipped,
 * so a second run only adds what is new.
 *
 * Passwords are NOT copied. Sign-in is People's; every copied user gets the
 * unusable placeholder, so a Review row alone can never sign anyone in.
 */
import fs from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { PEOPLE_MANAGED } from "../src/lib/people-managed";

const APPLY = process.argv.includes("--apply");

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const text = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = /^#?\s*([A-Z_]+)=(?:"([^"]*)"|(.*))$/.exec(line.trim());
    if (m) out[(line.trim().startsWith("#") ? "#" : "") + m[1]] = m[2] ?? m[3] ?? "";
  }
  return out;
}

const env = readEnv();
const sourceUrl = process.env.SOURCE_DATABASE_URL ?? env["#NEON_DIRECT_URL"] ?? env["#NEON_DATABASE_URL"];
const targetUrl = env["DIRECT_URL"];

function hostOf(url: string) {
  const u = new URL(url);
  return `${u.host}${u.pathname}`;
}

if (!sourceUrl) throw new Error("No source: set SOURCE_DATABASE_URL or keep the # NEON_DIRECT_URL line in .env.");
if (!targetUrl) throw new Error("No DIRECT_URL in .env.");
if (new URL(targetUrl).searchParams.get("schema") !== "review") {
  throw new Error("Refusing to run: DIRECT_URL must carry ?schema=review so People's tables cannot be touched.");
}
if (hostOf(sourceUrl) === hostOf(targetUrl)) throw new Error("Source and target are the same database.");

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

const json = (v: Prisma.JsonValue | null) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

async function copy<T>(label: string, rows: T[], write: (rows: T[]) => Promise<{ count: number }>) {
  if (!APPLY) {
    console.log(`  would copy ${String(rows.length).padStart(6)}  ${label}`);
    return;
  }
  // Chunked so a big audit table doesn't exceed Postgres' bind-parameter limit.
  let added = 0;
  for (let i = 0; i < rows.length; i += 500) added += (await write(rows.slice(i, i + 500))).count;
  console.log(`  copied ${String(added).padStart(6)} of ${String(rows.length).padStart(6)}  ${label}${added < rows.length ? " (rest already there)" : ""}`);
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${hostOf(sourceUrl!)}  ->  ${hostOf(targetUrl!)} (schema review)\n`);

  // Raw SELECTs: Neon runs the older schema, so the current client cannot read it field-by-field.
  const all = <T = Record<string, unknown>>(t: string) => source.$queryRawUnsafe<T[]>(`SELECT * FROM "${t}"`);
  const [organizations, departments, employees, links, users, submissions, audit] = await Promise.all([
    all<Prisma.OrganizationCreateManyInput>("Organization"),
    all<Prisma.DepartmentCreateManyInput>("Department"),
    all<Prisma.EmployeeCreateManyInput & { id: string; email: string; isActive: boolean }>("Employee"),
    all<Prisma.EmployeeDepartmentLinkCreateManyInput>("EmployeeDepartmentLink"),
    all<Prisma.UserCreateManyInput & { email: string; isActive: boolean; name: string; role: string }>("User"),
    all<Prisma.FeedbackSubmissionCreateManyInput & { id: string; updatedAt: Date }>("FeedbackSubmission"),
    all<{ before: Prisma.JsonValue; after: Prisma.JsonValue; metadata: Prisma.JsonValue } & Record<string, unknown>>("AuditEvent"),
  ]);

  // A person already in the target under another id (added there directly) keeps the target row.
  const targetEmp = await target.employee.findMany({ select: { id: true, email: true } });
  const tIds = new Set(targetEmp.map((e) => e.id));
  const tEmails = new Set(targetEmp.map((e) => e.email.toLowerCase()));
  const newEmployees = employees.filter((e) => tIds.has(e.id) || !tEmails.has(e.email.toLowerCase()));
  for (const e of employees) if (!tIds.has(e.id) && tEmails.has(e.email.toLowerCase())) console.log(`  skip employee ${e.email}: already in target under another id`);

  // Parents before children, so every foreign key already exists.
  await copy("organizations", organizations, (data) => target.organization.createMany({ data, skipDuplicates: true }));
  await copy("departments", departments, (data) => target.department.createMany({ data, skipDuplicates: true }));
  await copy("employees", newEmployees, (data) => target.employee.createMany({ data, skipDuplicates: true }));
  await copy("employee-department links", links, (data) => target.employeeDepartmentLink.createMany({ data, skipDuplicates: true }));
  await copy(
    "users (passwords not copied)",
    users.map((u) => ({ ...u, passwordHash: PEOPLE_MANAGED, mustChangePassword: false, failedLoginAttempts: 0, lockedUntil: null })),
    (data) => target.user.createMany({ data: data as Prisma.UserCreateManyInput[], skipDuplicates: true })
  );
  await copy("feedback submissions", submissions, (data) => target.feedbackSubmission.createMany({ data, skipDuplicates: true }));

  // Submissions that moved on in Neon after the last copy (e.g. confirmed, sent): Neon wins when newer.
  const tSub = new Map((await target.feedbackSubmission.findMany({ select: { id: true, updatedAt: true } })).map((x) => [x.id, x.updatedAt]));
  const newer = submissions.filter((x) => tSub.has(x.id) && +x.updatedAt > +tSub.get(x.id)!);
  console.log(`  ${APPLY ? "updated" : "would update"} ${String(newer.length).padStart(5)}  feedback submissions changed in Neon since the last copy`);
  if (APPLY) for (const x of newer) { const { id, ...data } = x; await target.feedbackSubmission.update({ where: { id }, data, select: { id: true } }); }

  await copy(
    "audit events",
    audit.map((a) => ({ ...a, before: json(a.before ?? null), after: json(a.after ?? null), metadata: json(a.metadata ?? null) })) as unknown as Prisma.AuditEventCreateManyInput[],
    (data) => target.auditEvent.createMany({ data, skipDuplicates: true })
  );

  // Who will not be able to sign in: no matching People account (read-only).
  const peopleEmails = new Set(
    (await target.$queryRaw<{ email: string }[]>`SELECT lower("email") AS email FROM "public"."User" WHERE "isActive" = true`).map((r) => r.email)
  );
  const noAccount = users.filter((u) => u.isActive && !peopleEmails.has(u.email.toLowerCase()));
  const employeesNotInPeople = employees.filter((e) => e.isActive && !peopleEmails.has(e.email.toLowerCase())).length;

  console.log(`\nReview users with NO active People account (they will not be able to sign in): ${noAccount.length}`);
  for (const u of noAccount) console.log(`  - ${u.name} <${u.email}>  [${u.role}]`);
  console.log(`\nActive employees whose email has no People login (fine for being reviewed, they just can't sign in): ${employeesNotInPeople}`);
  if (!APPLY) console.log("\nNothing was written. Re-run with --apply to copy.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
