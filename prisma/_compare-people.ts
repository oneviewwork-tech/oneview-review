// TEMPORARY read-only comparison of Review vs People. Deleted after use.
import { find, loadPeople, reviewClient, type PeopleEmp } from "./_people";

const db = reviewClient();
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

async function main() {
  const people = await loadPeople(db);
  const orgs = await db.$queryRaw<{ code: string; name: string }[]>`SELECT "code","name" FROM "public"."Organization" ORDER BY 1`;
  const peopleDepts = await db.$queryRaw<{ org: string; name: string }[]>`
    SELECT o."code" AS org, d."name" FROM "public"."Department" d JOIN "public"."Organization" o ON o."id" = d."organizationId"`;
  const reviewOrgs = await db.organization.findMany({ select: { code: true } });
  const emps = await db.employee.findMany({ include: { organization: { select: { code: true } }, department: { select: { name: true } } } });
  const reviewDepts = await db.department.findMany({ select: { name: true, organization: { select: { code: true } } } });

  console.log("ORGANIZATIONS");
  for (const o of orgs) {
    const pa = people.filter((p) => p.orgCode === o.code);
    const ra = emps.filter((e) => e.organization.code === o.code);
    console.log(
      `  ${o.code.padEnd(12)} People: ${pa.length} total / ${pa.filter((p) => p.active).length} active / ${peopleDepts.filter((d) => d.org === o.code).length} depts` +
        `   Review: ${reviewOrgs.some((r) => r.code === o.code) ? `${ra.length} total / ${ra.filter((e) => e.isActive).length} active / ${reviewDepts.filter((d) => d.organization.code === o.code).length} depts` : "NOT IN REVIEW"}`
    );
  }

  // People side: who is in People but not in Review
  const matchedReview = new Set<string>();
  const missing: PeopleEmp[] = [];
  const nameDiff: string[] = [];
  const deptDiff: string[] = [];
  const desigDiff: string[] = [];
  const statusDiff: string[] = [];
  for (const p of people) {
    const pool = emps.filter((e) => e.organization.code === p.orgCode).map((e) => ({ ...e, name: e.name }));
    const email = (e: (typeof pool)[number]) => [e.email, e.peopleEmail].filter(Boolean).map((x) => x!.toLowerCase());
    const byEmail = pool.find((e) => email(e).includes(p.officialEmail) || (p.loginEmail && email(e).includes(p.loginEmail)));
    const hit = byEmail ?? (() => { const r = find(p.name, p.officialEmail, [{ ...p } as PeopleEmp]); void r; return undefined; })();
    let e = hit;
    if (!e) {
      const m = pool.filter((x) => norm(x.name) === norm(p.name));
      if (m.length === 1) e = m[0];
    }
    if (!e) {
      if (p.active) missing.push(p);
      continue;
    }
    matchedReview.add(e.id);
    if (norm(e.name) !== norm(p.name)) nameDiff.push(`${e.name}  ->  ${p.name}`);
    if (p.department && norm(e.department.name) !== norm(p.department)) deptDiff.push(`${p.name}: Review “${e.department.name}” vs People “${p.department}”`);
    if (p.designation && norm(e.designation) !== norm(p.designation)) desigDiff.push(`${p.name}: “${e.designation ?? "—"}” vs “${p.designation}”`);
    if (e.isActive !== p.active) statusDiff.push(`${p.name}: Review ${e.isActive ? "active" : "inactive"}, People ${p.active ? "active" : "inactive"}`);
  }
  const onlyReview = emps.filter((e) => !matchedReview.has(e.id) && e.isActive);

  const show = (t: string, l: string[], n = 25) => {
    console.log(`\n${t}: ${l.length}`);
    l.slice(0, n).forEach((x) => console.log("   - " + x));
    if (l.length > n) console.log(`   … and ${l.length - n} more`);
  };
  show("IN PEOPLE (active) BUT NOT IN REVIEW", missing.map((p) => `${p.name} — ${p.orgCode} · ${p.department ?? "no department"} · ${p.designation ?? "—"}`), 40);
  show("IN REVIEW (active) BUT NOT IN PEOPLE", onlyReview.map((e) => `${e.name} <${e.email}> — ${e.organization.code} · ${e.department.name}`));
  show("DIFFERENT NAME", nameDiff);
  show("DIFFERENT DEPARTMENT", deptDiff);
  show("DIFFERENT DESIGNATION", desigDiff, 10);
  show("DIFFERENT ACTIVE STATUS", statusDiff);

  const pd = new Set(peopleDepts.map((d) => `${d.org}|${norm(d.name)}`));
  const rd = new Set(reviewDepts.map((d) => `${d.organization.code}|${norm(d.name)}`));
  show("DEPARTMENTS IN PEOPLE, NOT IN REVIEW", [...pd].filter((d) => !rd.has(d)));
  show("DEPARTMENTS IN REVIEW, NOT IN PEOPLE", [...rd].filter((d) => !pd.has(d)));
}
main().finally(() => db.$disconnect());
