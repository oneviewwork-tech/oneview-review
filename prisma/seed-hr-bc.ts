/**
 * Loads the Haris & Co. HR and Brand Consultants scorecards from HR's sheets,
 * with the scores already given in them (HR: Aug-Oct 2026 weekly; Brand
 * Consultants: Oct 2026 monthly), recorded as confirmed months like
 * import-history.ts.
 *
 *  - Scorecards are built from the sheets themselves (KRA / KPI / weight).
 *    If a month's sheet lists different KPIs, that month gets its own version.
 *  - "8(comment)" -> 8 points with the comment as the remark. "HANDOVER" and
 *    blank cells are not scores. A value above the KPI's weight is reported
 *    and skipped. Each sheet's own total is compared with ours and any
 *    difference is printed.
 *  - Brand Consultants are scored monthly, so the month's figure is stored as
 *    week 1 (the month result is the average of scored weeks).
 *  - Scorer = Team Lead in People, else reporting manager; a missing Review
 *    login is created (People-managed). Nothing existing is overwritten.
 *
 *   npx tsx prisma/seed-hr-bc.ts "<scratch dir with aug/sep/oct/bc .xlsx>"            # dry run
 *   npx tsx prisma/seed-hr-bc.ts "<dir>" --apply
 */
import path from "node:path";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { PEOPLE_MANAGED } from "../src/lib/people-managed";
import { scoreMonth, type KpiDef, type RawScores } from "../src/domain/performance/engine";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const DIR = process.argv.slice(2).find((a) => !a.startsWith("--"))!;
const db = reviewClient();

type Kpi = { kra: string; name: string; max: number };
type Cell = { value: number; remark: string | null };
interface Sheet { file: string; tab: string; period: Date; template: string; person: string; kpis: Kpi[]; weeks: Map<number, Map<string, Cell>>; sheetTotal: number | null; critical: string[] }

const PEOPLE: Record<string, { email: string; template: string }> = {
  Shilpa: { email: "careers@harisand.co", template: "HR – HR Officer" },
  Ashiga: { email: "hrrecruiter@harisand.co", template: "HR – Talent Acquisition" },
  Shamna: { email: "", template: "HR – Talent Acquisition" }, // resigned; matched by name
  Habeeb: { email: "", template: "Brand Consultants – Brand Consultant" },
  Azeem: { email: "azeem@harisand.co", template: "Brand Consultants – Junior Brand Consultant" },
  Christy: { email: "", template: "Brand Consultants – Technical Project Manager (R&D)" },
};
const ROLE_DEF: Record<string, string> = {
  "HR – HR Officer": "Runs day-to-day HR operations: onboarding and induction, attendance and leave, payroll, statutory compliance, employee documentation and asset checks.",
  "HR – Talent Acquisition": "Closes open positions: sourcing, interview scheduling and coordination, candidate quality, offers and joining, with recruitment process compliance.",
};

const text = (c: ExcelJS.Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown; text?: unknown; richText?: { text: string }[] }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** "8(comment)" / "8 (comment)" / "8" -> value + remark; anything else -> null. */
function parseScore(s: string): Cell | null {
  const m = /^(\d+(?:\.\d+)?)\s*(?:\(([\s\S]*)\)?)?([\s\S]*)$/.exec(s);
  if (!m) return null;
  const remark = [m[2], m[3]].filter(Boolean).join(" ").replace(/^\)|\)$/g, "").trim();
  return { value: Number(m[1]), remark: remark ? remark.slice(0, 500) : null };
}

async function readWeekly(file: string, period: Date): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DIR, file));
  const out: Sheet[] = [];
  wb.eachSheet((ws) => {
    const person = ws.name.replace(/\s*\d+$/, "").trim();
    let header = 0;
    const weekCols: { col: number; week: number }[] = [];
    ws.eachRow((r, i) => {
      if (header) return;
      for (let c = 1; c <= 12; c++) {
        const m = /^week\s*(\d)$/i.exec(text(r.getCell(c)));
        if (m) weekCols.push({ col: c, week: Number(m[1]) });
      }
      if (weekCols.length) header = i;
    });
    const kpis: Kpi[] = [];
    const weeks = new Map<number, Map<string, Cell>>();
    let sheetTotal: number | null = null;
    ws.eachRow((r, i) => {
      if (i <= header) return;
      const kra = text(r.getCell(1)), name = text(r.getCell(2)), w = num(text(r.getCell(3)));
      if (/^total$/i.test(kra) || !kra || !name || w == null) return;
      kpis.push({ kra, name, max: w });
      for (const { col, week } of weekCols) {
        const raw = text(r.getCell(col));
        if (!raw || /handover/i.test(raw)) continue;
        const sc = parseScore(raw);
        if (!sc) continue;
        const m = weeks.get(week) ?? new Map();
        m.set(keyOf(name), sc);
        weeks.set(week, m);
      }
    });
    // The sheet's own monthly figure: the last lone number below the table.
    ws.eachRow((r, i) => {
      if (i <= header) return;
      const vals = Array.from({ length: 12 }, (_, c) => text(r.getCell(c + 1))).filter(Boolean);
      if (vals.length === 1 && num(vals[0]) != null && Number(vals[0]) <= 100) sheetTotal = Number(vals[0]);
    });
    const tmpl = PEOPLE[person]?.template;
    if (!tmpl) return console.log(`  ! ${file} tab "${ws.name}": no scorecard mapping for ${person}; skipped`);
    out.push({ file, tab: ws.name, period, template: tmpl, person, kpis, weeks, sheetTotal, critical: [] });
  });
  return out;
}

async function readMonthly(file: string, period: Date): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(DIR, file));
  const out: Sheet[] = [];
  wb.eachSheet((ws) => {
    const person = ws.name.trim();
    const kpis: Kpi[] = [];
    const week = new Map<string, Cell>();
    const critical: string[] = [];
    let sheetTotal: number | null = null;
    ws.eachRow((r, i) => {
      if (i === 1) return;
      const b = text(r.getCell(2)), c = text(r.getCell(3)), d = text(r.getCell(4));
      const a = text(r.getCell(1)) || (num(c) != null && b ? b : "");
      if (/^total$/i.test(a)) return void (sheetTotal = num(d));
      if (/^critical$/i.test(a)) return void critical.push(b + (/^yes$/i.test(d) ? "  [flagged: YES]" : ""));
      // A row whose KPI cell holds the weight (e.g. "Outbound initiatives | 3 | 2") is its own KRA.
      const [kra, name, w, v] = num(b) != null && num(c) != null && !d ? [a, a, num(b), num(c)] : [a, b, num(c), num(d)];
      if (!kra || !name || w == null) return;
      kpis.push({ kra, name, max: w });
      if (v != null) week.set(keyOf(name), { value: v, remark: null });
    });
    const tmpl = PEOPLE[person]?.template;
    if (!tmpl) return console.log(`  ! ${file} tab "${ws.name}": no scorecard mapping; skipped`);
    out.push({ file, tab: ws.name, period, template: tmpl, person, kpis, weeks: new Map([[1, week]]), sheetTotal, critical });
  });
  return out;
}

const sig = (k: Kpi[]) => k.map((x) => `${keyOf(x.kra)}|${keyOf(x.name)}|${x.max}`).join(";");

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const month = (m: number) => new Date(Date.UTC(2026, m, 1));
  const sheets = [
    ...(await readWeekly("aug.xlsx", month(7))),
    ...(await readWeekly("sep.xlsx", month(8))),
    ...(await readWeekly("oct.xlsx", month(9))),
    ...(await readMonthly("bc.xlsx", month(9))),
  ];

  // ── Scorecards and their versions ────────────────────────────────────
  const versions = new Map<string, { from: Date; kpis: Kpi[]; critical: string[] }[]>();
  for (const s of [...sheets].sort((a, b) => +a.period - +b.period)) {
    const total = s.kpis.reduce((a, k) => a + k.max, 0);
    const list = versions.get(s.template) ?? [];
    const last = list.at(-1);
    if (!last || sig(last.kpis) !== sig(s.kpis)) {
      if (last && +last.from === +s.period) {
        // Two people on one scorecard in the same month with different KPI lists: keep the first, report.
        console.log(`  ! ${s.person} ${s.file}: KPI list differs from the other ${s.template} sheet this month; using the first`);
      } else list.push({ from: s.period, kpis: s.kpis, critical: s.critical });
    }
    versions.set(s.template, list);
    if (Math.abs(total - 100) > 1e-9) console.log(`  ! ${s.person} ${s.file}: weights total ${total}, not 100`);
  }
  const existing = new Set((await db.perfTemplate.findMany({ select: { name: true } })).map((t) => t.name));
  console.log("SCORECARDS");
  for (const [name, list] of versions) {
    for (const v of list) console.log(`  ${name.padEnd(52)} from ${v.from.toISOString().slice(0, 7)}: ${v.kpis.length} KPIs, ${new Set(v.kpis.map((k) => k.kra)).size} KRAs = ${v.kpis.reduce((a, k) => a + k.max, 0)}${v.critical.length ? ` | critical: ${v.critical.length}` : ""}${existing.has(name) ? "  [exists, skipped]" : ""}`);
  }

  // ── People, scorers, logins ──────────────────────────────────────────
  const ppl = await db.$queryRaw<{ id: string; first: string; name: string; email: string; status: string; dept: string | null; designation: string | null; login: string | null; tl: string | null; tlName: string | null; rm: string | null; rmName: string | null }[]>`
    SELECT e."id", e."firstName" AS "first", trim(regexp_replace(e."firstName" || ' ' || e."lastName", '\\s+', ' ', 'g')) AS "name", lower(e."officialEmail") AS "email", e."employmentStatus"::text AS "status", dep."name" AS "dept", des."title" AS "designation", lower(u."email") AS "login",
           lower(coalesce(tu."email", t."officialEmail")) AS "tl", trim(t."firstName" || ' ' || t."lastName") AS "tlName",
           lower(coalesce(mu."email", m."officialEmail")) AS "rm", trim(m."firstName" || ' ' || m."lastName") AS "rmName"
    FROM "public"."Employee" e
    JOIN "public"."Organization" o ON o."id" = e."organizationId" AND o."code" = 'HARISCO'
    LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    LEFT JOIN "public"."Department" dep ON dep."id" = e."departmentId"
    LEFT JOIN "public"."Designation" des ON des."id" = e."designationId"
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId" LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId" LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"`;
  const findPerson = (who: string) => {
    const want = PEOPLE[who].email;
    const hits = want ? ppl.filter((p) => p.email === want) : ppl.filter((p) => p.first.trim().toLowerCase().startsWith(who.toLowerCase()));
    return hits.length === 1 ? hits[0] : null;
  };
  const [employees, users, depts] = await Promise.all([
    db.employee.findMany({ select: { id: true, name: true, peopleEmployeeId: true, isActive: true, _count: { select: { submissions: true } } } }),
    db.user.findMany({ select: { id: true, email: true, name: true } }),
    db.department.findMany({ where: { organization: { code: "HARISCO" } }, select: { id: true, name: true, organizationId: true } }),
  ]);
  const deptFor = (name: string | null) => {
    const n = (name ?? "").toLowerCase();
    return depts.find((d) => d.name.toLowerCase() === n) ?? depts.find((d) => (n === "human resources" && d.name === "HR") || (n === "bd" && /brand consultants/i.test(d.name)));
  };
  const renames: { id: string; from: string; to: string }[] = [];
  const creates: { who: string; p: (typeof ppl)[number]; deptId: string; orgId: string }[] = [];
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  console.log("\nPEOPLE");
  const plan = new Map<string, { employeeId: string; employeeName: string; template: string; scorerEmail: string; scorerName: string; via: string }>();
  const loginsToCreate = new Map<string, string>();
  for (const who of Object.keys(PEOPLE)) {
    if (!sheets.some((s) => s.person === who)) continue;
    const p = findPerson(who);
    if (!p) { console.log(`  ! ${who}: not found as exactly one Haris&Co. person in People; skipped`); continue; }
    let e = employees.find((x) => x.peopleEmployeeId === p.id);
    if (!e) {
      // No Review record yet (e.g. left before Review existed): create one, inactive unless still working.
      const d = deptFor(p.dept);
      if (!d) { console.log(`  ! ${p.name}: no Review department for "${p.dept}"; skipped`); continue; }
      creates.push({ who, p, deptId: d.id, orgId: d.organizationId });
      e = { id: `new:${who}`, name: p.name, peopleEmployeeId: p.id, isActive: p.status === "ACTIVE" || p.status === "ON_NOTICE", _count: { submissions: 0 } };
      console.log(`  + Review employee for ${p.name} (${p.status.toLowerCase()}) in ${d.name}`);
    } else if (e.name !== p.name && e._count.submissions === 0) {
      // The record is linked to this person but carries someone else's name (a shared mailbox): use People's.
      renames.push({ id: e.id, from: e.name, to: p.name });
      console.log(`  ~ rename Review employee "${e.name}" → "${p.name}" (it is linked to ${p.name} in People; no feedback history)`);
      e = { ...e, name: p.name };
    }
    const scorerEmail = p.tl ?? p.rm;
    const scorerName = (p.tl ? p.tlName : p.rmName) ?? "?";
    if (!scorerEmail) { console.log(`  ! ${p.name}: no team lead or reporting manager in People; skipped`); continue; }
    if (!userByEmail.has(scorerEmail)) loginsToCreate.set(scorerEmail, scorerName);
    plan.set(who, { employeeId: e.id, employeeName: e.name, template: PEOPLE[who].template, scorerEmail, scorerName, via: p.tl ? "team lead" : "reporting manager" });
    console.log(`  ${e.name.padEnd(22)} → ${PEOPLE[who].template.padEnd(50)} scored by ${scorerName} (${p.tl ? "team lead" : "reporting manager"})${e.isActive ? "" : "  [inactive in Review]"}`);
  }
  for (const [email, name] of loginsToCreate) console.log(`  + Review login for ${name} <${email}> (signs in with People)`);

  // ── Months ───────────────────────────────────────────────────────────
  const assigned = new Set((await db.perfAssignment.findMany({ select: { employeeId: true } })).map((a) => a.employeeId));
  const reviews = new Set((await db.perfReview.findMany({ select: { employeeId: true, period: true } })).map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));
  console.log("\nMONTHS");
  const months: { s: Sheet; who: NonNullable<ReturnType<typeof plan.get>>; avg: number | null; max: number; weeks: number }[] = [];
  for (const s of sheets) {
    const who = plan.get(s.person);
    if (!who) continue;
    const v = versions.get(s.template)!.filter((x) => +x.from <= +s.period).at(-1)!;
    const defs: KpiDef[] = v.kpis.map((k) => ({ id: keyOf(k.name), kraId: keyOf(k.kra), maxPoints: k.max, mode: "RATING" as const }));
    const raw: RawScores[] = Array.from({ length: 5 }, () => ({}));
    const problems: string[] = [];
    for (const [w, cells] of s.weeks) {
      for (const [k, c] of cells) {
        const def = defs.find((d) => d.id === k);
        if (!def) { problems.push(`week ${w}: "${k}" isn't on the scorecard`); continue; }
        if (c.value > def.maxPoints) { problems.push(`week ${w}: "${k}" = ${c.value} is above its ${def.maxPoints}; skipped`); cells.delete(k); continue; }
        raw[w - 1][k] = c.value;
      }
    }
    const res = scoreMonth(defs, raw);
    const max = v.kpis.reduce((a, k) => a + k.max, 0);
    const ym = s.period.toISOString().slice(0, 7);
    const diff = s.sheetTotal != null && res.average != null && Math.abs(res.average - s.sheetTotal) > 0.05 ? `  ≠ sheet ${s.sheetTotal}` : "";
    console.log(`  ${ym} ${who.employeeName.padEnd(22)} weeks ${res.weeksScored}  result ${res.average ?? "-"} / ${max}${diff}${reviews.has(`${who.employeeId}|${ym}`) ? "  [month already recorded, skipped]" : ""}`);
    for (const p of problems) console.log(`        ! ${p}`);
    for (const c of s.critical.filter((x) => x.includes("YES"))) console.log(`        ! critical flagged in the sheet: ${c.replace("  [flagged: YES]", "")} (no deduction amount given, not deducted)`);
    months.push({ s, who, avg: res.average, max, weeks: res.weeksScored });
  }

  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  // ── Write ────────────────────────────────────────────────────────────
  for (const r of renames) await db.employee.update({ where: { id: r.id }, data: { name: r.to }, select: { id: true } });
  for (const c of creates) {
    const made = await db.employee.create({
      data: { name: c.p.name, email: c.p.email, peopleEmployeeId: c.p.id, designation: c.p.designation, organizationId: c.orgId, departmentId: c.deptId, isActive: c.p.status === "ACTIVE" || c.p.status === "ON_NOTICE" },
      select: { id: true },
    });
    plan.get(c.who)!.employeeId = made.id;
    console.log(`  created Review employee ${c.p.name}`);
  }
  for (const m of months) m.who = plan.get(m.s.person)!;
  for (const [email, name] of loginsToCreate) {
    const u = await db.user.create({ data: { email, name, role: "EMPLOYEE", passwordHash: PEOPLE_MANAGED, mustChangePassword: false }, select: { id: true, email: true, name: true } });
    userByEmail.set(email, u);
  }
  const templateIds = new Map((await db.perfTemplate.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]));
  for (const [name, list] of versions) {
    if (existing.has(name)) continue;
    const t = await db.perfTemplate.create({ data: { name, roleDefinition: ROLE_DEF[name] ?? null }, select: { id: true } });
    templateIds.set(name, t.id);
    for (const v of list) {
      const kras = [...new Set(v.kpis.map((k) => k.kra))];
      await db.perfTemplateVersion.create({
        data: {
          templateId: t.id,
          effectiveFrom: v.from,
          kras: { create: kras.map((kra, i) => ({ name: kra, sortOrder: i, kpis: { create: v.kpis.filter((k) => k.kra === kra).map((k, j) => ({ name: k.name, maxPoints: k.max, sortOrder: j })) } })) },
          risks: { create: v.critical.map((c, i) => ({ category: "Critical", name: c.replace("  [flagged: YES]", ""), alertLevel: "Critical KPI", deductible: false, sortOrder: i })) },
        },
      });
    }
    console.log(`  created ${name} (${list.length} version${list.length > 1 ? "s" : ""})`);
  }
  for (const who of plan.values()) {
    if (assigned.has(who.employeeId)) continue;
    await db.perfAssignment.create({ data: { employeeId: who.employeeId, templateId: templateIds.get(who.template)!, scorerUserId: userByEmail.get(who.scorerEmail)!.id } });
    assigned.add(who.employeeId);
  }
  for (const m of months) {
    const ym = m.s.period.toISOString().slice(0, 7);
    if (reviews.has(`${m.who.employeeId}|${ym}`)) continue;
    const scorer = userByEmail.get(m.who.scorerEmail)!;
    const version = await db.perfTemplateVersion.findFirst({
      where: { templateId: templateIds.get(m.s.template)!, effectiveFrom: { lte: m.s.period } },
      orderBy: { effectiveFrom: "desc" },
      include: { kras: { include: { kpis: true } } },
    });
    const kpiId = new Map(version!.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
    const rows: Prisma.PerfScoreCreateManyInput[] = [];
    for (const [week, cells] of m.s.weeks) for (const [k, c] of cells) {
      const id = kpiId.get(k);
      if (id) rows.push({ employeeId: m.who.employeeId, kpiId: id, period: m.s.period, week, value: c.value, remark: c.remark, enteredById: scorer.id, enteredByName: "Imported from HR sheet" });
    }
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: rows, skipDuplicates: true });
      const now = new Date();
      await tx.perfReview.create({
        data: {
          employeeId: m.who.employeeId, period: m.s.period, status: "CONFIRMED",
          submittedById: scorer.id, submittedByName: "Imported from HR sheet", submittedAt: now,
          decidedById: scorer.id, decidedByName: "Imported from HR sheet", decidedAt: now,
          finalScore: m.avg, maxScore: m.max, weeksScored: m.weeks,
        },
      });
      await writeAuditEvent(tx, { entityType: "PerfScore", entityId: m.who.employeeId, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { scores: rows.length }, metadata: { source: "hr-bc-import", sheet: `${m.s.file}/${m.s.tab}`, period: ym } });
    });
    console.log(`  recorded ${ym} ${m.who.employeeName}: ${rows.length} scores`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
