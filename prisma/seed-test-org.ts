/**
 * TEST DATABASE ONLY. A small demo company to try every screen with:
 * 5 departments across both organizations, 4 people each, and October 2026
 * scored week by week on the Demo Scorecard.
 *
 * In each department:
 *   Head      (Team Lead role)  — scored by the Test Admin
 *   Manager   (Employee role)   — scored by the Head (so the Head reviews them)
 *   2 staff   (Employee role)   — scored by the Manager (reviewed by the Head)
 *
 * Results are a deliberate mix: strong, steady and weak performers; most
 * weeks scored, some late; months confirmed, submitted, sent back or still
 * in draft; one critical KPI deduction. Everyone signs in with Test@1234
 * (or use the account switcher).
 *
 * Run seed-test-logins.ts and seed-test-scorecard.ts first. Refuses to run
 * unless DATABASE_URL points at localhost. Re-running replaces this demo.
 *
 *   DATABASE_URL="postgresql://postgres:localtest@127.0.0.1:55433/oneview_test?schema=review" \
 *     npx tsx prisma/seed-test-org.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type PerfReviewStatus } from "@prisma/client";
import { PEOPLE_MANAGED } from "../src/lib/people-managed";
import { scoreMonth, type KpiDef } from "../src/domain/performance/engine";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing: DATABASE_URL is not a local database.");
  process.exit(1);
}
const db = new PrismaClient({ datasources: { db: { url } } });

const PASSWORD = "Test@1234";
const PERIOD = new Date(Date.UTC(2026, 9, 1)); // October 2026
const WEEK_DATES = ["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"];

type Person = { first: string; last: string; title: string; level: number; weeks: number; state: PerfReviewStatus | "DRAFT"; penalty?: number };
const DEPARTMENTS: { org: "HARISCO" | "HACA"; name: string; code: string; people: [Person, Person, Person, Person] }[] = [
  {
    org: "HARISCO",
    name: "Web Development",
    code: "DEMO-WEB",
    people: [
      { first: "Arjun", last: "Menon", title: "Head of Web", level: 88, weeks: 4, state: "CONFIRMED" },
      { first: "Sneha", last: "Pillai", title: "Web Team Lead", level: 82, weeks: 4, state: "CONFIRMED" },
      { first: "Rahul", last: "Nair", title: "Frontend Developer", level: 91, weeks: 4, state: "CONFIRMED" },
      { first: "Divya", last: "Raj", title: "Junior Developer", level: 74, weeks: 4, state: "SUBMITTED" },
    ],
  },
  {
    org: "HARISCO",
    name: "SEO",
    code: "DEMO-SEO",
    people: [
      { first: "Faisal", last: "Rahman", title: "Head of SEO", level: 79, weeks: 4, state: "CONFIRMED" },
      { first: "Nimisha", last: "Thomas", title: "SEO Strategist", level: 76, weeks: 4, state: "SUBMITTED" },
      { first: "Akhil", last: "Das", title: "SEO Analyst", level: 63, weeks: 3, state: "DRAFT", penalty: 10 },
      { first: "Riya", last: "Joseph", title: "Content Writer", level: 85, weeks: 4, state: "CONFIRMED" },
    ],
  },
  {
    org: "HARISCO",
    name: "Branding",
    code: "DEMO-BRD",
    people: [
      { first: "Meera", last: "Varma", title: "Head of Branding", level: 92, weeks: 4, state: "CONFIRMED" },
      { first: "Kiran", last: "Kumar", title: "Design Lead", level: 87, weeks: 4, state: "CONFIRMED" },
      { first: "Anjali", last: "Suresh", title: "Graphic Designer", level: 69, weeks: 4, state: "NEEDS_REVISION" },
      { first: "Vishnu", last: "Prasad", title: "Motion Designer", level: 78, weeks: 2, state: "DRAFT" },
    ],
  },
  {
    org: "HACA",
    name: "Academics",
    code: "DEMO-ACD",
    people: [
      { first: "Saira", last: "Banu", title: "Head of Academics", level: 84, weeks: 4, state: "CONFIRMED" },
      { first: "Nikhil", last: "George", title: "Academic Lead", level: 77, weeks: 4, state: "CONFIRMED" },
      { first: "Fathima", last: "Hiba", title: "Tech Mentor", level: 95, weeks: 4, state: "CONFIRMED" },
      { first: "Jibin", last: "Mathew", title: "Design Mentor", level: 66, weeks: 4, state: "SUBMITTED" },
    ],
  },
  {
    org: "HACA",
    name: "Sales",
    code: "DEMO-SAL",
    people: [
      { first: "Rohan", last: "Iyer", title: "Head of Sales", level: 73, weeks: 4, state: "SUBMITTED" },
      { first: "Aisha", last: "Kareem", title: "Sales Lead", level: 81, weeks: 3, state: "DRAFT" },
      { first: "Manu", last: "Krishnan", title: "Admissions Counsellor", level: 58, weeks: 4, state: "CONFIRMED", penalty: 15 },
      { first: "Neha", last: "Shenoy", title: "Admissions Counsellor", level: 89, weeks: 1, state: "DRAFT" },
    ],
  },
];

/** Deterministic pseudo-random, so re-runs give the same scores. */
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const half = (n: number) => Math.round(n * 2) / 2;

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();
  const template = await db.perfTemplate.findFirst({
    where: { name: "Demo Scorecard" },
    include: { versions: { include: { kras: { include: { kpis: true } }, risks: true }, orderBy: { effectiveFrom: "desc" } } },
  });
  if (!template) throw new Error("Run seed-test-scorecard.ts first (no Demo Scorecard).");
  const version = template.versions[0];
  const kpis = version.kras.flatMap((k) => k.kpis);
  const defs: KpiDef[] = kpis.map((k) => ({ id: k.id, kraId: k.kraId, maxPoints: k.maxPoints, mode: "RATING" }));
  const risk = version.risks.find((r) => r.deductible);
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@test.local" } });
  const orgs = await db.organization.findMany();
  const orgId = (code: string) => orgs.find((o) => o.code === code)!.id;

  // Re-running replaces the demo: clear its people first.
  const old = await db.employee.findMany({ where: { email: { endsWith: "@demo.test" } }, select: { id: true } });
  const oldIds = old.map((e) => e.id);
  await db.perfPenalty.deleteMany({ where: { employeeId: { in: oldIds } } });
  await db.perfReview.deleteMany({ where: { employeeId: { in: oldIds } } });
  await db.perfScore.deleteMany({ where: { employeeId: { in: oldIds } } });
  await db.perfAssignment.deleteMany({ where: { employeeId: { in: oldIds } } });
  await db.employee.deleteMany({ where: { id: { in: oldIds } } });
  await db.notification.deleteMany({ where: { user: { email: { endsWith: "@demo.test" } } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@demo.test" } } });
  await db.$executeRaw`DELETE FROM "public"."User" WHERE "email" LIKE '%@demo.test'`;
  await db.$executeRaw`DELETE FROM "public"."Employee" WHERE "officialEmail" LIKE '%@demo.test'`;
  await db.$executeRaw`INSERT INTO "public"."Organization" ("id","name","code","updatedAt") VALUES ('t_org_haca','HACA','HACA',${now}) ON CONFLICT DO NOTHING`;
  await db.$executeRaw`INSERT INTO "public"."Role" ("id","name","updatedAt") VALUES ('t_role_emp','Employee',${now}) ON CONFLICT DO NOTHING`;

  let n = 0;
  for (const d of DEPARTMENTS) {
    const dept = await db.department.upsert({
      where: { organizationId_name: { organizationId: orgId(d.org), name: d.name } },
      create: { organizationId: orgId(d.org), name: d.name, code: d.code },
      update: {},
    });
    const peopleOrg = d.org === "HACA" ? "t_org_haca" : "t_org_harisco";

    // People: login (People side + Review side) and employee record.
    const made: { userId: string; employeeId: string; name: string; p: Person }[] = [];
    for (const [i, p] of d.people.entries()) {
      n++;
      const name = `${p.first} ${p.last}`;
      const email = `${p.first}.${p.last}@demo.test`.toLowerCase();
      const pid = `demo_${d.code}_${i}`;
      await db.$executeRaw`
        INSERT INTO "public"."Employee" ("id","employeeCode","firstName","lastName","gender","officialEmail","dateOfJoining","updatedAt","organizationId")
        VALUES (${pid}, ${"DEMO" + n}, ${p.first}, ${p.last}, 'OTHER', ${email}, ${now}, ${now}, ${peopleOrg})`;
      await db.$executeRaw`
        INSERT INTO "public"."User" ("id","email","passwordHash","updatedAt","employeeId","roleId")
        VALUES (${"u_" + pid}, ${email}, ${hash}, ${now}, ${pid}, 't_role_emp')`;
      const head = i === 0;
      const user = await db.user.create({
        data: {
          email,
          name,
          role: head ? "DEPARTMENT_HEAD" : "EMPLOYEE",
          reviewRoleId: head ? "role_team_lead" : "role_employee",
          departmentId: head ? dept.id : null,
          passwordHash: PEOPLE_MANAGED,
          mustChangePassword: false,
        },
      });
      const employee = await db.employee.create({
        data: {
          name,
          email,
          organizationId: orgId(d.org),
          departmentId: dept.id,
          designation: p.title,
          peopleEmployeeId: pid,
          reportingManagerName: i === 0 ? null : i === 1 ? `${d.people[0].first} ${d.people[0].last}` : `${d.people[1].first} ${d.people[1].last}`,
        },
      });
      made.push({ userId: user.id, employeeId: employee.id, name, p });
    }

    // Who scores whom: Admin → Head → Manager → staff.
    const scorerOf = (i: number) => (i === 0 ? { id: admin.id, name: admin.name } : i === 1 ? { id: made[0].userId, name: made[0].name } : { id: made[1].userId, name: made[1].name });
    const reviewerOf = (i: number) => (i === 0 ? null : i === 1 ? admin.id : made[0].userId);

    for (const [i, m] of made.entries()) {
      const scorer = scorerOf(i);
      await db.perfAssignment.create({ data: { employeeId: m.employeeId, templateId: template.id, scorerUserId: scorer.id } });

      // Weekly scores around the person's level.
      const weeks: Record<string, number>[] = [];
      for (let w = 1; w <= m.p.weeks; w++) {
        const raw: Record<string, number> = {};
        for (const k of kpis) {
          const share = Math.min(1, Math.max(0, (m.p.level + (rand() - 0.5) * 16) / 100));
          raw[k.id] = half(k.maxPoints * share);
          await db.perfScore.create({
            data: {
              employeeId: m.employeeId,
              kpiId: k.id,
              period: PERIOD,
              week: w,
              value: raw[k.id],
              enteredById: scorer.id,
              enteredByName: scorer.name,
              createdAt: new Date(WEEK_DATES[w - 1] + "T12:00:00Z"),
            },
          });
        }
        weeks.push(raw);
      }

      if (m.p.penalty && risk) {
        await db.perfPenalty.create({
          data: { employeeId: m.employeeId, riskId: risk.id, period: PERIOD, points: m.p.penalty, remark: "Demo: missed a client deadline.", enteredById: scorer.id, enteredByName: scorer.name },
        });
      }

      if (m.p.state !== "DRAFT") {
        const month = scoreMonth(defs, weeks, m.p.penalty ?? 0);
        const confirmed = m.p.state === "CONFIRMED";
        const decider = i === 0 ? null : i === 1 ? { id: admin.id, name: admin.name } : { id: made[0].userId, name: made[0].name };
        await db.perfReview.create({
          data: {
            employeeId: m.employeeId,
            period: PERIOD,
            status: m.p.state,
            submittedById: scorer.id,
            submittedByName: scorer.name,
            submittedAt: new Date("2026-11-01T09:00:00Z"),
            reviewerUserId: reviewerOf(i),
            ...(m.p.state === "SUBMITTED" ? {} : { decidedById: decider?.id ?? admin.id, decidedByName: decider?.name ?? admin.name, decidedAt: new Date("2026-11-02T06:00:00Z") }),
            ...(m.p.state === "NEEDS_REVISION" ? { revisionNote: "Week 3 quality looks too high; please recheck.", revisionRequestedAt: new Date("2026-11-02T06:00:00Z") } : {}),
            ...(confirmed ? { finalScore: month.average, maxScore: 100, weeksScored: month.weeksScored } : {}),
          },
        });
        // Confirmed staff rate their manager and head (demo upward feedback).
        if (confirmed && i > 0) {
          const notes = ["Very supportive and clear with feedback.", "Could give feedback earlier in the week.", null, "Always available when I'm stuck."];
          await db.managerRating.create({
            data: { raterEmployeeId: m.employeeId, period: PERIOD, ratedAs: "SCORER", targetUserId: scorer.id, stars: 3 + Math.floor(rand() * 3), message: notes[Math.floor(rand() * notes.length)] },
          });
          const reviewer = reviewerOf(i);
          if (reviewer && reviewer !== scorer.id) {
            await db.managerRating.create({
              data: { raterEmployeeId: m.employeeId, period: PERIOD, ratedAs: "REVIEWER", targetUserId: reviewer, stars: 2 + Math.floor(rand() * 4), message: null },
            });
          }
        }
      }
    }
    console.log(`${d.org.padEnd(8)} ${d.name.padEnd(16)} ${made.map((m) => `${m.name} (${m.p.state.toLowerCase()})`).join(", ")}`);
  }
  console.log(`\n${n} people. Password for all: ${PASSWORD} (emails firstname.lastname@demo.test)`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
