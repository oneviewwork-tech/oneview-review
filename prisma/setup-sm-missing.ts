/**
 * Adds the Review scorecard assignment for Social Media people whose
 * history sheet carries real data but who were never set up: active
 * people get an ordinary assignment, resigned ones get one too (needed so
 * seed-sm-history.ts has a scorer and a version to record against) even
 * though they'll never log in or be scored going forward. Matched to
 * template by which existing scorecard's KPI structure their sheet uses
 * (Managers file -> Social Media Manager template; Design TEAM -> Video
 * Editor template; Writers -> Writer template), per the user's "load what
 * is in the sheet, exactly as it is" instruction - not by their official
 * People designation, which can differ (e.g. Akash/Akshay's "Graphic
 * Designer" title but Video Editor KPIs on the Design TEAM sheet).
 *
 *   npx tsx prisma/setup-sm-missing.ts            # dry run
 *   npx tsx prisma/setup-sm-missing.ts --apply
 */
import { reviewClient } from "./_people";
const APPLY = process.argv.includes("--apply");
const db = reviewClient();

const PLAN: { email: string; template: string; scorerEmail: string }[] = [
  { email: "jithinraj@harisand.co", template: "Social Media – Writer", scorerEmail: "umair@harisand.co" },
  { email: "nazil@harisand.co", template: "Social Media – Social Media Manager", scorerEmail: "nabil@harisand.co" },
  { email: "shekha@harisand.co", template: "Social Media – Social Media Manager", scorerEmail: "nabil@harisand.co" },
  { email: "amalshamsudheen@harisand.co", template: "Social Media – Social Media Manager", scorerEmail: "nabil@harisand.co" },
  { email: "nafisa@harisand.co", template: "Social Media – Social Media Manager", scorerEmail: "nabil@harisand.co" },
  { email: "muhammed.binshad@harisand.co", template: "Social Media – Video Editor", scorerEmail: "nabil@harisand.co" },
  { email: "nikhil@harisand.co", template: "Social Media – Video Editor", scorerEmail: "nabil@harisand.co" },
  { email: "suhail@harisand.co", template: "Social Media – Video Editor", scorerEmail: "umair@harisand.co" },
  { email: "jasim@harisand.co", template: "Social Media – Video Editor", scorerEmail: "nabil@harisand.co" },
];

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const templates = await db.perfTemplate.findMany({ select: { id: true, name: true } });
  const tId = new Map(templates.map((t) => [t.name, t.id]));
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const dept = await db.department.findFirst({ where: { name: "Social Media", organization: { code: "HARISCO" } }, select: { id: true, organizationId: true } });
  if (!dept) throw new Error("No Social Media department.");

  const people = await db.$queryRaw<{ id: string; name: string; email: string; designation: string | null; manager: string | null; login: string | null }[]>`
    SELECT e."id", trim(regexp_replace(e."firstName" || ' ' || e."lastName", '\s+', ' ', 'g')) AS "name", lower(e."officialEmail") AS "email",
           d."title" AS "designation", trim(m."firstName" || ' ' || m."lastName") AS "manager", lower(u."email") AS "login"
    FROM "public"."Employee" e
    LEFT JOIN "public"."Designation" d ON d."id" = e."designationId"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId"
    LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    WHERE lower(e."officialEmail") = ANY(${PLAN.map((p) => p.email)})`;
  const byEmail = new Map(people.map((p) => [p.email, p]));

  for (const p of PLAN) {
    const t = tId.get(p.template);
    if (!t) { console.log(`  ! ${p.template}: not found`); continue; }
    const scorerId = userByEmail.get(p.scorerEmail);
    if (!scorerId) { console.log(`  ! ${p.scorerEmail}: no Review login`); continue; }

    let e = await db.employee.findFirst({ where: { email: p.email }, select: { id: true, name: true, perfAssignment: true } });
    if (!e) {
      const pp = byEmail.get(p.email);
      if (!pp) { console.log(`  ! ${p.email}: not in People`); continue; }
      console.log(`  + create Review employee ${pp.name} <${p.email}>`);
      if (APPLY) {
        const created = await db.employee.create({ data: { name: pp.name, email: p.email, peopleEmail: pp.login ?? p.email, peopleEmployeeId: pp.id, designation: pp.designation, reportingManagerName: pp.manager, organizationId: dept.organizationId, departmentId: dept.id }, select: { id: true, name: true, perfAssignment: true } });
        e = created;
      }
    }
    if (!APPLY && !e) continue; // dry run, employee doesn't exist yet to check assignment on
    if (e?.perfAssignment) { console.log(`  = ${e.name}: already assigned`); continue; }
    console.log(`  + assign ${p.email} -> ${p.template}, scored by ${p.scorerEmail}`);
    if (APPLY && e) await db.perfAssignment.create({ data: { employeeId: e.id, templateId: t, scorerUserId: scorerId } });
  }
  console.log(APPLY ? "\nDone." : "\nNothing written. Re-run with --apply.");
}
main().finally(() => db.$disconnect());
