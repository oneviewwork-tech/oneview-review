/**
 * Puts the Haris & Co. SEO team on the SEO scorecards (loaded earlier by
 * seed-seo.ts), matching roles from HR's REPORT HIERARCHY sheet. Scorer =
 * Team Lead in People, else reporting manager; a missing Review login is
 * created (People-managed). Existing assignments are left alone.
 *
 *   npx tsx prisma/seed-seo-assign.ts            # dry run
 *   npx tsx prisma/seed-seo-assign.ts --apply
 */
import { PEOPLE_MANAGED } from "../src/lib/people-managed";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();

/** First name in People -> scorecard (from REPORT HIERARCHY.xlsx). */
const ROLES: [string, string][] = [
  ["Aparna", "SEO Team Lead"],
  ["Harithbaran", "SEO Analyst"],
  ["Basith", "SEO Analyst"],
  ["Shahinsha", "SEO Analyst – Junior"],
  ["Muhammed Aman", "SEO Analyst – Junior"],
  ["Nidhin", "SEO Content Writer – Junior"],
  ["Jithin", "SEO Technical Developer – Lead"],
  ["Shakir", "SEO Technical Developer – Junior"],
  ["Riyas Ali", "SEO Content Lead"],
];

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const ppl = await db.$queryRaw<{ id: string; name: string; status: string; scorerEmail: string | null; scorerName: string | null; via: string }[]>`
    SELECT e."id", trim(regexp_replace(e."firstName" || ' ' || e."lastName", '\\s+', ' ', 'g')) AS "name", e."employmentStatus"::text AS "status",
           lower(coalesce(tu."email", t."officialEmail", mu."email", m."officialEmail")) AS "scorerEmail",
           trim(coalesce(t."firstName" || ' ' || t."lastName", m."firstName" || ' ' || m."lastName")) AS "scorerName",
           CASE WHEN t."id" IS NOT NULL THEN 'team lead' ELSE 'reporting manager' END AS "via"
    FROM "public"."Employee" e
    JOIN "public"."Organization" o ON o."id" = e."organizationId" AND o."code" = 'HARISCO'
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId" LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId" LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"
    WHERE e."archivedAt" IS NULL`;
  const [templates, employees, users, assigned] = await Promise.all([
    db.perfTemplate.findMany({ select: { id: true, name: true } }),
    db.employee.findMany({ select: { id: true, name: true, peopleEmployeeId: true } }),
    db.user.findMany({ select: { id: true, email: true } }),
    db.perfAssignment.findMany({ select: { employeeId: true } }),
  ]);
  const tId = new Map(templates.map((t) => [t.name, t.id]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const has = new Set(assigned.map((a) => a.employeeId));

  const plan: { employeeId: string; templateId: string; scorerEmail: string; scorerName: string }[] = [];
  const logins = new Map<string, string>();
  for (const [first, template] of ROLES) {
    const hits = ppl.filter((p) => p.name.toLowerCase().startsWith(first.toLowerCase()) && p.status !== "TERMINATED");
    const p = hits.length === 1 ? hits[0] : null;
    if (!p) { console.log(`  ! ${first}: ${hits.length ? "more than one" : "no"} match in People; skipped`); continue; }
    if (!["ACTIVE", "ON_NOTICE"].includes(p.status)) { console.log(`  - ${p.name}: ${p.status.toLowerCase()} in People; not assigned`); continue; }
    const e = employees.find((x) => x.peopleEmployeeId === p.id);
    if (!e) { console.log(`  ! ${p.name}: no Review employee; skipped`); continue; }
    if (has.has(e.id)) { console.log(`  = ${e.name}: already assigned`); continue; }
    const t = tId.get(template);
    if (!t) { console.log(`  ! ${template}: scorecard not found; skipped`); continue; }
    if (!p.scorerEmail) { console.log(`  ! ${p.name}: no team lead or manager in People; skipped`); continue; }
    if (!userByEmail.has(p.scorerEmail)) logins.set(p.scorerEmail, p.scorerName ?? p.scorerEmail);
    plan.push({ employeeId: e.id, templateId: t, scorerEmail: p.scorerEmail, scorerName: p.scorerName ?? "?" });
    console.log(`  + ${e.name.padEnd(22)} → ${template.padEnd(34)} scored by ${p.scorerName} (${p.via})${p.status === "ON_NOTICE" ? "  [on notice]" : ""}`);
  }
  for (const [email, name] of logins) console.log(`  + Review login for ${name} <${email}> (signs in with People)`);
  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  for (const [email, name] of logins) {
    const u = await db.user.create({ data: { email, name, role: "EMPLOYEE", passwordHash: PEOPLE_MANAGED, mustChangePassword: false }, select: { id: true } });
    userByEmail.set(email, u.id);
  }
  for (const x of plan) await db.perfAssignment.create({ data: { employeeId: x.employeeId, templateId: x.templateId, scorerUserId: userByEmail.get(x.scorerEmail)! } });
  console.log(`\nDone. ${plan.length} assigned.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
