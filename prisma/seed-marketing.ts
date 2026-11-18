/**
 * Loads the Haris & Co. internal Marketing team's scorecards and October 2026
 * scores.
 *
 *  - Main roles (11) from the weekly workbook (Marketing_KPI_KRA_Weekly): each
 *    KPI has its own weight ("Wt"); weekly ratings are 0-10, stored as points
 *    = rating / 10 x weight (the sheet's own "Σ(KPI÷10 × weight)").
 *  - Intern / junior roles (7) from the definitions workbook (KPI KRA
 *    Defined), where a KRA's weight is split evenly across its KPIs.
 *  - Critical KPIs come from the definitions workbook; it gives no deduction
 *    amounts, so they are shown but not deducted. Grades use the app's bands.
 *  - October weeks with ratings are recorded as a confirmed month for people
 *    found in People; everyone is scored by their Team Lead (else reporting
 *    manager). Nothing existing is overwritten.
 *
 *   npx tsx prisma/seed-marketing.ts <weekly.xlsx> <defined.xlsx>            # dry run
 *   npx tsx prisma/seed-marketing.ts <weekly.xlsx> <defined.xlsx> --apply
 */
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { PEOPLE_MANAGED } from "../src/lib/people-managed";
import { scoreMonth, type KpiDef, type RawScores } from "../src/domain/performance/engine";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const [WEEKLY, DEFINED] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const db = reviewClient();
const FROM = new Date(Date.UTC(2026, 9, 1)); // October 2026
const PREFIX = "Marketing – ";

/** People in People's Marketing department whose role isn't on a sheet tab, mapped by hand. */
const ASSIGN_BY_EMAIL_NAME: [first: string, tab: string][] = [
  ["Muhammad Umair", "Marketing Team Lead"],
  ["Lewin", "Video Editor"],
];

type Kpi = { kra: string; name: string; max: number };
const text = (c: ExcelJS.Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const kraName = (s: string) => s.replace(/\s*\(\d+\)\s*$/, "").trim();

async function main() {
  if (!WEEKLY || !DEFINED) throw new Error("Usage: seed-marketing.ts <weekly.xlsx> <defined.xlsx> [--apply]");
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");

  // ── Definitions workbook: intern roles + every role's critical KPIs ──
  const def = new ExcelJS.Workbook();
  await def.xlsx.readFile(DEFINED);
  const defined = new Map<string, { kpis: Kpi[]; risks: { category: string; name: string; description: string }[] }>();
  def.eachSheet((ws) => {
    if (ws.name === "INDEX") return;
    const rows: { kra: string; kpi: string; w: number }[] = [];
    const risks: { category: string; name: string; description: string }[] = [];
    let mode: "" | "kpi" | "risk" = "";
    ws.eachRow((r) => {
      const a = text(r.getCell(1)), b = text(r.getCell(2)), c = text(r.getCell(3)), d = text(r.getCell(4));
      if (a === "KRA") return void (mode = "kpi");
      if (/^PENALTY/i.test(a)) return void (mode = "risk");
      if (a === "Risk Area" || /^TOTAL/i.test(a)) return;
      if (mode === "kpi" && a && b && num(d) != null) rows.push({ kra: a, kpi: b, w: Number(d) });
      if (mode === "risk" && a && b) risks.push({ category: a, name: b, description: c });
    });
    // The KRA's weight is repeated on each of its KPI rows: split it evenly.
    const kpis: Kpi[] = [];
    for (const kra of [...new Set(rows.map((x) => x.kra))]) {
      const mine = rows.filter((x) => x.kra === kra);
      for (const x of mine) kpis.push({ kra, name: x.kpi, max: mine[0].w / mine.length });
    }
    defined.set(ws.name, { kpis, risks });
  });

  // ── Weekly workbook: main roles' KPI weights and October ratings ──
  const wk = new ExcelJS.Workbook();
  await wk.xlsx.readFile(WEEKLY);
  const cards = new Map<string, { kpis: Kpi[]; risks: { category: string; name: string; description: string }[] }>();
  const scores: { tab: string; who: string; weeks: Map<number, Map<string, number>>; sheetMonth: number | null }[] = [];
  const skipTabs = new Set(["DASHBOARD", "INDIVIDUAL", "MONTHLY", "SCORING GUIDE", "SETTINGS", "ROSTER", "DATA", "Interns & Juniors"]);
  wk.eachSheet((ws) => {
    if (skipTabs.has(ws.name)) return;
    let octCols: { col: number; week: number }[] = [];
    const kpis: Kpi[] = [];
    let current: (typeof scores)[number] | null = null;
    let firstBlockDone = false;
    ws.eachRow((r) => {
      const a = text(r.getCell(1)), b = text(r.getCell(2)), w = num(text(r.getCell(4)));
      if (a === "MONTH →") {
        octCols = [];
        let n = 0;
        for (let c = 5; c <= 12; c++) if (text(r.getCell(c)) === "Oct") octCols.push({ col: c, week: ++n });
        return;
      }
      if (a === "EMPLOYEE ▸") {
        const who = b;
        current = who ? { tab: ws.name, who, weeks: new Map(), sheetMonth: num(text(r.getCell(8))) } : null;
        if (current) scores.push(current);
        return;
      }
      if (/^WEIGHTED/.test(a)) { firstBlockDone = true; current = null; return; }
      if (!a || !b || w == null) return;
      if (!firstBlockDone) kpis.push({ kra: kraName(a), name: b, max: w });
      if (current) {
        for (const { col, week } of octCols) {
          const v = num(text(r.getCell(col)));
          if (v == null) continue;
          const m = current.weeks.get(week) ?? new Map();
          m.set(keyOf(b), v);
          current.weeks.set(week, m);
        }
      }
    });
    if (kpis.length) cards.set(ws.name, { kpis, risks: defined.get(ws.name)?.risks ?? [] });
  });
  // Intern / junior roles only exist in the definitions workbook.
  for (const [tab, d] of defined) if (!cards.has(tab)) cards.set(tab, d);

  const existing = new Set((await db.perfTemplate.findMany({ select: { name: true } })).map((t) => t.name));
  console.log("SCORECARDS");
  let bad = false;
  for (const [tab, c] of cards) {
    const total = c.kpis.reduce((s, k) => s + k.max, 0);
    if (Math.abs(total - 100) > 1e-6) bad = true;
    console.log(`  ${(PREFIX + tab).padEnd(48)} ${String(c.kpis.length).padStart(2)} KPIs / ${new Set(c.kpis.map((k) => k.kra)).size} KRAs = ${+total.toFixed(2)} | critical ${c.risks.length} (watch only)${existing.has(PREFIX + tab) ? "  [exists, skipped]" : ""}`);
  }
  if (bad) throw new Error("A scorecard doesn't total 100. Nothing written.");

  // ── People ──
  const ppl = await db.$queryRaw<{ id: string; name: string; status: string; dept: string | null; scorerEmail: string | null; scorerName: string | null; via: string }[]>`
    SELECT e."id", trim(regexp_replace(e."firstName" || ' ' || e."lastName", '\\s+', ' ', 'g')) AS "name", e."employmentStatus"::text AS "status", dep."name" AS "dept",
           lower(coalesce(tu."email", t."officialEmail", mu."email", m."officialEmail")) AS "scorerEmail",
           trim(coalesce(t."firstName" || ' ' || t."lastName", m."firstName" || ' ' || m."lastName")) AS "scorerName",
           CASE WHEN t."id" IS NOT NULL THEN 'team lead' ELSE 'reporting manager' END AS "via"
    FROM "public"."Employee" e
    JOIN "public"."Organization" o ON o."id" = e."organizationId" AND o."code" = 'HARISCO'
    LEFT JOIN "public"."Department" dep ON dep."id" = e."departmentId"
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId" LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId" LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"
    WHERE e."archivedAt" IS NULL AND e."employmentStatus"::text IN ('ACTIVE', 'ON_NOTICE')`;
  const [employees, users, assigned, reviews] = await Promise.all([
    db.employee.findMany({ select: { id: true, name: true, peopleEmployeeId: true } }),
    db.user.findMany({ select: { id: true, email: true } }),
    db.perfAssignment.findMany({ select: { employeeId: true } }),
    db.perfReview.findMany({ where: { period: FROM }, select: { employeeId: true } }),
  ]);
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const has = new Set(assigned.map((a) => a.employeeId));
  const hasOct = new Set(reviews.map((r) => r.employeeId));
  /** One person by first name, preferring People's Marketing department. */
  const find = (first: string) => {
    const all = ppl.filter((p) => p.name.toLowerCase().split(" ").some((part, i) => (i === 0 ? p.name.toLowerCase().startsWith(first.toLowerCase()) : part === first.toLowerCase())));
    const mkt = all.filter((p) => p.dept === "Marketing");
    return mkt.length === 1 ? mkt[0] : all.length === 1 ? all[0] : null;
  };

  console.log("\nPEOPLE");
  const plan: { employeeId: string; name: string; tab: string; scorerEmail: string; month?: (typeof scores)[number] }[] = [];
  const logins = new Map<string, string>();
  const people: [string, string, (typeof scores)[number] | undefined][] = [
    ...scores.map((s) => [s.who, s.tab, s] as [string, string, (typeof scores)[number]]),
    ...ASSIGN_BY_EMAIL_NAME.map(([f, t]) => [f, t, undefined] as [string, string, undefined]),
  ];
  for (const [who, tab, month] of people) {
    const p = find(who);
    if (!p) { console.log(`  ! ${who} (${tab}): not found as one active Haris&Co. person in People; skipped`); continue; }
    const e = employees.find((x) => x.peopleEmployeeId === p.id);
    if (!e) { console.log(`  ! ${p.name}: no Review employee; skipped`); continue; }
    if (has.has(e.id)) { console.log(`  = ${p.name}: already on a scorecard, left as is`); continue; }
    if (!p.scorerEmail) { console.log(`  ! ${p.name}: no team lead or manager; skipped`); continue; }
    if (!userByEmail.has(p.scorerEmail)) logins.set(p.scorerEmail, p.scorerName ?? p.scorerEmail);
    const weeks = month?.weeks.size ?? 0;
    plan.push({ employeeId: e.id, name: p.name, tab, scorerEmail: p.scorerEmail, month: weeks ? month : undefined });
    has.add(e.id);
    console.log(`  + ${p.name.padEnd(20)} → ${(PREFIX + tab).padEnd(44)} scored by ${p.scorerName} (${p.via})${weeks ? `  | Oct: ${weeks} weeks` : ""}`);
  }
  for (const [email, name] of logins) console.log(`  + Review login for ${name} <${email}> (signs in with People)`);

  console.log("\nOCTOBER");
  const months: { x: (typeof plan)[number]; avg: number | null; max: number; weeks: number }[] = [];
  for (const x of plan) {
    if (!x.month) continue;
    const c = cards.get(x.tab)!;
    const defs: KpiDef[] = c.kpis.map((k) => ({ id: keyOf(k.name), kraId: keyOf(k.kra), maxPoints: k.max, mode: "RATING" as const }));
    const raw: RawScores[] = Array.from({ length: 5 }, () => ({}));
    for (const [w, m] of x.month.weeks) for (const [k, rating] of m) {
      const d = defs.find((dd) => dd.id === k);
      if (d && rating >= 0 && rating <= 10) raw[w - 1][k] = (rating / 10) * d.maxPoints;
    }
    const res = scoreMonth(defs, raw);
    const avg = res.average == null ? null : Math.round(res.average * 100) / 100;
    const sheet = x.month.sheetMonth;
    console.log(`  ${x.name.padEnd(20)} weeks ${res.weeksScored}  result ${avg} / 100${sheet != null && avg != null && Math.abs(avg - sheet) > 0.1 ? `  ≠ sheet ${sheet}` : ""}${hasOct.has(x.employeeId) ? "  [October already recorded, skipped]" : ""}`);
    months.push({ x, avg, max: 100, weeks: res.weeksScored });
  }

  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  for (const [email, name] of logins) {
    const u = await db.user.create({ data: { email, name, role: "EMPLOYEE", passwordHash: PEOPLE_MANAGED, mustChangePassword: false }, select: { id: true } });
    userByEmail.set(email, u.id);
  }
  const tIds = new Map((await db.perfTemplate.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]));
  for (const [tab, c] of cards) {
    const name = PREFIX + tab;
    if (existing.has(name)) continue;
    const kras = [...new Set(c.kpis.map((k) => k.kra))];
    const t = await db.perfTemplate.create({
      data: {
        name,
        versions: {
          create: {
            effectiveFrom: FROM,
            kras: { create: kras.map((kra, i) => ({ name: kra, sortOrder: i, kpis: { create: c.kpis.filter((k) => k.kra === kra).map((k, j) => ({ name: k.name, maxPoints: k.max, sortOrder: j })) } })) },
            risks: { create: c.risks.map((r, i) => ({ category: r.category, name: r.name, description: r.description || null, alertLevel: "Critical KPI", deductible: false, sortOrder: i })) },
          },
        },
      },
      select: { id: true },
    });
    tIds.set(name, t.id);
  }
  console.log(`  scorecards created`);
  for (const x of plan) await db.perfAssignment.create({ data: { employeeId: x.employeeId, templateId: tIds.get(PREFIX + x.tab)!, scorerUserId: userByEmail.get(x.scorerEmail)! } });
  console.log(`  ${plan.length} assigned`);

  for (const m of months) {
    if (hasOct.has(m.x.employeeId)) continue;
    const scorer = userByEmail.get(m.x.scorerEmail)!;
    const version = await db.perfTemplateVersion.findFirst({ where: { templateId: tIds.get(PREFIX + m.x.tab)! }, include: { kras: { include: { kpis: true } } } });
    const kpiId = new Map(version!.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k]));
    const rows: Prisma.PerfScoreCreateManyInput[] = [];
    for (const [week, cells] of m.x.month!.weeks) for (const [k, rating] of cells) {
      const kpi = kpiId.get(k);
      if (kpi && rating >= 0 && rating <= 10) rows.push({ employeeId: m.x.employeeId, kpiId: kpi.id, period: FROM, week, value: Math.round((rating / 10) * kpi.maxPoints * 100) / 100, remark: `Rated ${rating}/10`, enteredById: scorer, enteredByName: "Imported from Marketing sheet" });
    }
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: rows, skipDuplicates: true });
      const now = new Date();
      await tx.perfReview.create({
        data: { employeeId: m.x.employeeId, period: FROM, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from Marketing sheet", submittedAt: now, decidedById: scorer, decidedByName: "Imported from Marketing sheet", decidedAt: now, finalScore: m.avg, maxScore: m.max, weeksScored: m.weeks },
      });
      await writeAuditEvent(tx, { entityType: "PerfScore", entityId: m.x.employeeId, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { scores: rows.length }, metadata: { source: "marketing-import", period: "2026-10" } });
    });
    console.log(`  recorded October for ${m.x.name}: ${rows.length} scores`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
