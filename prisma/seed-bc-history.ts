/**
 * Brand Consultants' June-September 2026 history from "KRA & KPI BC DEPT.xlsx"
 * (Azeem, Habeeb). The sheet's week columns are irregular, but each month has
 * one column carrying the month's figures (its "Monthly Avg", or the last week
 * where HR wrote the month total); those columns are named below and checked
 * against the sheet's Total row. Recorded as confirmed months, week 1, on the
 * scorecards loaded for October (a month with different KPIs gets its own
 * version). April-May (placeholder zeros), Christy (unlabelled months) and
 * leavers are not imported. Nothing existing is overwritten.
 *
 *   npx tsx prisma/seed-bc-history.ts <bc.xlsx>            # dry run
 *   npx tsx prisma/seed-bc-history.ts <bc.xlsx> --apply
 */
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"))!;
const db = reviewClient();
const m = (mm: number) => new Date(Date.UTC(2026, mm, 1));

/** Tab -> employee email, scorecard, and the column holding each month. */
const TABS: Record<string, { email: string; template: string; months: [Date, number][] }> = {
  AZEEM: { email: "azeem@harisand.co", template: "Brand Consultants – Junior Brand Consultant", months: [[m(5), 10], [m(6), 15], [m(7), 20], [m(8), 25]] },
  Habeeb: { email: "", template: "Brand Consultants – Brand Consultant", months: [[m(5), 7], [m(6), 11], [m(7), 16], [m(8), 21]] },
};

type Kpi = { kra: string; name: string; max: number };
const text = (c: ExcelJS.Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sig = (k: Kpi[]) => k.map((x) => `${keyOf(x.name)}=${x.max}`).sort().join(";");

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  const [employees, templates, reviews] = await Promise.all([
    db.employee.findMany({ where: { department: { organization: { code: "HARISCO" } } }, select: { id: true, name: true, email: true, perfAssignment: { select: { templateId: true, scorerUserId: true } } } }),
    db.perfTemplate.findMany({ where: { name: { startsWith: "Brand Consultants" } }, select: { id: true, name: true, versions: { select: { effectiveFrom: true, kras: { select: { name: true, kpis: { select: { name: true, maxPoints: true } } } } } } } }),
    db.perfReview.findMany({ select: { employeeId: true, period: true } }),
  ]);
  const done = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));
  const plans: { e: (typeof employees)[number]; t: (typeof templates)[number]; period: Date; kpis: Kpi[]; values: Map<string, number>; total: number }[] = [];

  for (const [tab, cfg] of Object.entries(TABS)) {
    const ws = wb.getWorksheet(tab);
    const e = employees.find((x) => (cfg.email ? x.email.toLowerCase() === cfg.email : x.name.toLowerCase().startsWith(tab.toLowerCase())));
    const t = templates.find((x) => x.name === cfg.template);
    if (!ws || !e || !t || !e.perfAssignment) { console.log(`  ! ${tab}: tab, person, scorecard or assignment missing; skipped`); continue; }
    // KPI rows: KRA | KPI | weight (a row with no KRA is its own KRA).
    const rows: { kra: string; name: string; max: number; row: ExcelJS.Row }[] = [];
    let totalRow: ExcelJS.Row | null = null;
    ws.eachRow((r, i) => {
      if (i === 1) return;
      const a = text(r.getCell(1)), b = text(r.getCell(2)), w = num(text(r.getCell(3)));
      if (/^total$/i.test(a)) totalRow = r;
      if (/^(total|critical)$/i.test(a) || !b || w == null) return;
      rows.push({ kra: a || b, name: b, max: w, row: r });
    });
    for (const [period, col] of cfg.months) {
      const ym = period.toISOString().slice(0, 7);
      const values = new Map<string, number>();
      for (const k of rows) {
        const v = num(text(k.row.getCell(col)));
        if (v != null) values.set(keyOf(k.name), v);
      }
      const sum = Math.round([...values.values()].reduce((s, v) => s + v, 0) * 100) / 100;
      const sheetTotal = totalRow ? num(text((totalRow as ExcelJS.Row).getCell(col))) : null;
      const over = rows.filter((k) => (values.get(keyOf(k.name)) ?? 0) > k.max).map((k) => k.name);
      const ok = sheetTotal != null && Math.abs(sum - sheetTotal) <= 0.6 && over.length === 0;
      console.log(`  ${ym} ${e.name.padEnd(22)} ${sum} (sheet ${sheetTotal ?? "-"})${ok ? "" : "  ← doesn't check out, skipped"}${done.has(`${e.id}|${ym}`) ? "  [already recorded]" : ""}`);
      for (const o of over) console.log(`        ! "${o}" is above its weight`);
      if (ok && !done.has(`${e.id}|${ym}`)) plans.push({ e, t, period, kpis: rows.map(({ kra, name, max }) => ({ kra, name, max })), values, total: sum });
    }
  }

  // Versions: a month before the October scorecard, or with different KPIs, gets its own.
  const newVersions = new Map<string, { t: (typeof templates)[number]; from: Date; kpis: Kpi[] }>();
  for (const p of plans) {
    const vs = p.t.versions.map((v) => ({ from: v.effectiveFrom, kpis: v.kras.flatMap((k) => k.kpis.map((x) => ({ kra: k.name, name: x.name, max: x.maxPoints }))) }));
    const inForce = [...vs, ...[...newVersions.values()].filter((n) => n.t.id === p.t.id)].filter((v) => +v.from <= +p.period).sort((a, b) => +a.from - +b.from).at(-1);
    if (inForce && sig(inForce.kpis) === sig(p.kpis)) continue;
    const key = `${p.t.id}|${p.period.toISOString()}`;
    if (!newVersions.has(key)) {
      newVersions.set(key, { t: p.t, from: p.period, kpis: p.kpis });
      console.log(`  + version ${p.t.name} from ${p.period.toISOString().slice(0, 7)} (${p.kpis.length} KPIs = ${p.kpis.reduce((s, k) => s + k.max, 0)})`);
    }
  }
  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  for (const v of [...newVersions.values()].sort((a, b) => +a.from - +b.from)) {
    const kras = [...new Set(v.kpis.map((k) => k.kra))];
    await db.perfTemplateVersion.create({ data: { templateId: v.t.id, effectiveFrom: v.from, kras: { create: kras.map((kra, i) => ({ name: kra, sortOrder: i, kpis: { create: v.kpis.filter((k) => k.kra === kra).map((k, j) => ({ name: k.name, maxPoints: k.max, sortOrder: j })) } })) } } });
  }
  for (const p of plans) {
    const scorer = p.e.perfAssignment!.scorerUserId;
    const version = await db.perfTemplateVersion.findFirst({ where: { templateId: p.t.id, effectiveFrom: { lte: p.period } }, orderBy: { effectiveFrom: "desc" }, include: { kras: { include: { kpis: true } } } });
    const kpiId = new Map(version!.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
    const rows: Prisma.PerfScoreCreateManyInput[] = [...p.values].flatMap(([k, v]) => (kpiId.get(k) ? [{ employeeId: p.e.id, kpiId: kpiId.get(k)!, period: p.period, week: 1, value: v, remark: "Monthly score from BC sheet", enteredById: scorer, enteredByName: "Imported from BC sheet" }] : []));
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: rows, skipDuplicates: true });
      const now = new Date();
      await tx.perfReview.create({ data: { employeeId: p.e.id, period: p.period, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from BC sheet", submittedAt: now, decidedById: scorer, decidedByName: "Imported from BC sheet", decidedAt: now, finalScore: p.total, maxScore: p.kpis.reduce((s, k) => s + k.max, 0), weeksScored: 1 } });
      await writeAuditEvent(tx, { entityType: "PerfScore", entityId: p.e.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { scores: rows.length }, metadata: { source: "bc-history-import", period: p.period.toISOString().slice(0, 7) } });
    });
    console.log(`  recorded ${p.period.toISOString().slice(0, 7)} ${p.e.name}`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
