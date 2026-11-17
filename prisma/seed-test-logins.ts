/**
 * TEST DATABASE ONLY. Creates four sign-ins to exercise every role:
 *
 *   admin@test.local     Admin (People super admin → Review ADMIN)
 *   head@test.local      Department head (Review DEPARTMENT_HEAD, Test Department)
 *   manager@test.local   Reporting manager — reports to the head
 *   employee@test.local  Employee — reports to the manager
 *
 * All share the password below. People-side rows (Organization, Department,
 * Designation, Role, Employee, User) go in `public`, the way ONEVIEW People
 * would hold them; Review-side rows (Department, Employee, User) in `review`.
 * No scorecards or assignments — those are left to test through the app.
 *
 * Refuses to run unless DATABASE_URL points at localhost. Safe to re-run.
 *
 *   DATABASE_URL="postgresql://postgres:localtest@127.0.0.1:55433/oneview_test?schema=review" \
 *     npx tsx prisma/seed-test-logins.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PEOPLE_MANAGED } from "../src/lib/people-managed";

const PASSWORD = "Test@1234";
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing: DATABASE_URL is not a local database.");
  process.exit(1);
}
const db = new PrismaClient({ datasources: { db: { url } } });

const PEOPLE = [
  { key: "admin", first: "Test", last: "Admin", email: "admin@test.local", title: "Administrator", manager: null, superAdmin: true, reviewRole: "ADMIN" },
  { key: "head", first: "Dana", last: "Head", email: "head@test.local", title: "Head of Department", manager: null, superAdmin: false, reviewRole: "DEPARTMENT_HEAD" },
  { key: "manager", first: "Riya", last: "Manager", email: "manager@test.local", title: "Team Lead", manager: "head", superAdmin: false, reviewRole: "EMPLOYEE" },
  { key: "employee", first: "Eli", last: "Employee", email: "employee@test.local", title: "Executive", manager: "manager", superAdmin: false, reviewRole: "EMPLOYEE" },
] as const;

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  // ── People side (public schema), raw SQL as Review only ever reads it ──
  await db.$executeRaw`INSERT INTO "public"."Organization" ("id","name","code","updatedAt") VALUES ('t_org_harisco','Haris & Co.','HARISCO',${now}) ON CONFLICT DO NOTHING`;
  await db.$executeRaw`INSERT INTO "public"."Department" ("id","name","code","organizationId","updatedAt") VALUES ('t_dep','Test Department','TEST','t_org_harisco',${now}) ON CONFLICT DO NOTHING`;
  await db.$executeRaw`INSERT INTO "public"."Role" ("id","name","isSuperAdmin","updatedAt") VALUES ('t_role_admin','Super Admin',true,${now}) ON CONFLICT DO NOTHING`;
  await db.$executeRaw`INSERT INTO "public"."Role" ("id","name","updatedAt") VALUES ('t_role_emp','Employee',${now}) ON CONFLICT DO NOTHING`;

  for (const [i, p] of PEOPLE.entries()) {
    await db.$executeRaw`INSERT INTO "public"."Designation" ("id","title","updatedAt") VALUES (${"t_des_" + p.key}, ${p.title}, ${now}) ON CONFLICT DO NOTHING`;
    await db.$executeRaw`
      INSERT INTO "public"."Employee" ("id","employeeCode","firstName","lastName","gender","officialEmail","dateOfJoining","updatedAt","organizationId","departmentId","designationId","reportingManagerId")
      VALUES (${"t_emp_" + p.key}, ${"TEST" + (i + 1)}, ${p.first}, ${p.last}, 'OTHER', ${p.email}, ${now}, ${now}, 't_org_harisco', 't_dep', ${"t_des_" + p.key}, ${p.manager ? "t_emp_" + p.manager : null})
      ON CONFLICT DO NOTHING`;
    await db.$executeRaw`
      INSERT INTO "public"."User" ("id","email","passwordHash","updatedAt","employeeId","roleId")
      VALUES (${"t_user_" + p.key}, ${p.email}, ${hash}, ${now}, ${"t_emp_" + p.key}, ${p.superAdmin ? "t_role_admin" : "t_role_emp"})
      ON CONFLICT DO NOTHING`;
  }

  // ── Review side ─────────────────────────────────────────────────────
  const dept = await db.department.upsert({
    where: { organizationId_name: { organizationId: "org_harisco", name: "Test Department" } },
    create: { organizationId: "org_harisco", name: "Test Department", code: "TEST" },
    update: {},
  });
  for (const p of PEOPLE) {
    const name = `${p.first} ${p.last}`;
    const mgr = PEOPLE.find((x) => x.key === p.manager);
    await db.employee.upsert({
      where: { peopleEmployeeId: "t_emp_" + p.key },
      create: {
        name,
        email: p.email,
        organizationId: "org_harisco",
        departmentId: dept.id,
        designation: p.title,
        reportingManagerName: mgr ? `${mgr.first} ${mgr.last}` : null,
        peopleEmployeeId: "t_emp_" + p.key,
      },
      update: {},
    });
    await db.user.upsert({
      where: { email: p.email },
      create: {
        email: p.email,
        name,
        role: p.reviewRole,
        departmentId: p.reviewRole === "DEPARTMENT_HEAD" ? dept.id : null,
        passwordHash: PEOPLE_MANAGED,
        mustChangePassword: false,
      },
      update: {},
    });
    console.log(`${p.email.padEnd(22)} ${p.reviewRole.padEnd(16)} ${name}${mgr ? ` — reports to ${mgr.first} ${mgr.last}` : ""}`);
  }
  console.log(`\nPassword for all: ${PASSWORD}`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
