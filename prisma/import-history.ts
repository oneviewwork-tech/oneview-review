/**
 * Imports previous months' weekly scores from HR's performance sheets:
 *
 *   _Academic Excellence - Performance Metrics.xlsx   (Neha, Rashid; June/July/Aug)
 *   Team SHO - Performance Metrics - July.xlsx        (SHO, SEM tabs: July; INTERNSHIP tab: June)
 *
 * It takes SCORES (and their remarks) only. The scorecards themselves were
 * loaded earlier; the only scorecard content added here is the Academic Lead's
 * June and July versions, because that sheet's KPIs differ from August's, and
 * a score has to sit against the KPIs it was given for.
 *
 * Rules:
 *  - Existing scores are never overwritten (only empty slots are filled).
 *  - A person is matched by name among those assigned that scorecard; a
 *    partial match is listed so it can be checked, and an unmatched name is
 *    skipped and reported, never guessed.
 *  - Each imported person-month is recorded as CONFIRMED ("imported from HR
 *    sheet"), so it is locked and visible to the person like any final month.
 *  - Marketing School columns and the Sep tab (no scores) are left out.
 *
 * Dry run by default.
 *   npx tsx prisma/import-history.ts
 *   npx tsx prisma/import-history.ts --apply
 */
import path from "node:path";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { scoreMonth, type KpiDef, type RawScores } from "../src/domain/performance/engine";
import { matchByName } from "../src/domain/people/match";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const DL = path.join(process.env.USERPROFILE ?? "C:/Users/ASUS", "Downloads");
const FILES = {
  academic: path.join(DL, "_Academic Excellence - Performance Metrics.xlsx"),
  sho: path.join(DL, "Team SHO - Performance Metrics  - July.xlsx"),
};
const db = reviewClient();
const month = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1));

type Cell = ExcelJS.Cell;
const text = (c: Cell): string => {
  const v = c.value as unknown;
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return o.richText.map((t) => t.text).join("").trim();
    if (o.result != null) return String(o.result).trim();
    if (o.text) return o.text.trim();
  }
  return String(v).trim();
};
const num = (c: Cell): number | null => {
  const v = c.value as unknown;
  const raw = typeof v === "object" && v !== null && "result" in (v as object) ? (v as { result: unknown }).result : v;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
};
const key = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

interface SheetKpi {
  name: string;
  kra: string;
  max: number;
}
interface Entry {
  value: number;
  remark: string | null;
}
/** One person's month as found in a sheet: week -> KPI name -> entry. */
interface Parsed {
  who: string;
  period: Date;
  template: string;
  source: string;
  kpis: SheetKpi[];
  weeks: Map<number, Map<string, Entry>>;
}

// ── Academic Excellence: one tab per month, people side by side ────────
function parseAcademic(wb: ExcelJS.Workbook): Parsed[] {
  const out: Parsed[] = [];
  const tabs: [string, number][] = [["june", 6], ["july", 7], ["aug", 8]];
  const people: Record<string, string> = { neha: "Neha Prakash", rashid: "Mohammed Rashid A" };
  for (const [tab, m] of tabs) {
    const ws = wb.getWorksheet(tab);
    if (!ws) continue;
    const kpis: (SheetKpi & { row: number })[] = [];
    let kra = "";
    for (let r = 3; r <= 24; r++) {
      const a = text(ws.getCell(r, 1));
      if (a && key(a) === "category") break;
      if (a) kra = a;
      const name = text(ws.getCell(r, 3));
      const max = num(ws.getCell(r, 4));
      if (name && max && max > 0) kpis.push({ name, kra, max, row: r });
    }
    // Columns E..P: header row 1 names the person, row 2 the week.
    const cols: { col: number; person: string; week: number }[] = [];
    let current = "";
    for (let c = 5; c <= 16; c++) {
      const h = text(ws.getCell(1, c));
      if (h) current = key(h.split("-")[0]);
      const wk = /week\s*(\d)/i.exec(text(ws.getCell(2, c)));
      if (people[current] && wk) cols.push({ col: c, person: people[current], week: Number(wk[1]) });
    }
    for (const person of new Set(cols.map((c) => c.person))) {
      const weeks = new Map<number, Map<string, Entry>>();
      for (const c of cols.filter((x) => x.person === person)) {
        for (const k of kpis) {
          const v = num(ws.getCell(k.row, c.col));
          if (v === null) continue;
          const w = weeks.get(c.week) ?? new Map<string, Entry>();
          w.set(key(k.name), { value: v, remark: null });
          weeks.set(c.week, w);
        }
      }
      out.push({ who: person, period: month(2026, m), template: "Academic Lead", source: `Academic Excellence · ${tab}`, kpis, weeks });
    }
  }
  return out;
}

// ── Team SHO: people side by side, a "Remark" column after most weeks ──
function parseTeamTab(ws: ExcelJS.Worksheet, template: string, period: Date, firstDataRow: number, lastRow: number, nameCol: number): Parsed[] {
  const kpis: SheetKpi[] = [];
  let kra = "";
  for (let r = firstDataRow; r <= lastRow; r++) {
    const a = text(ws.getCell(r, 1));
    if (a) kra = a;
    const name = text(ws.getCell(r, nameCol));
    const max = num(ws.getCell(r, 3));
    if (name && max && max > 0) kpis.push({ name, kra, max, row: r } as SheetKpi & { row: number });
  }
  const rowOf = new Map(kpis.map((k) => [k.name, (k as SheetKpi & { row: number }).row]));

  const out: Parsed[] = [];
  let person = "";
  let lastWeekCol = 0;
  const cols: { person: string; col: number; week?: number; remarkFor?: number }[] = [];
  for (let c = 4; c <= ws.columnCount; c++) {
    const h = text(ws.getCell(1, c));
    if (h) person = h;
    const label = key(text(ws.getCell(2, c)));
    const wk = /^week\s*(\d)/.exec(label);
    if (!person) continue;
    if (wk) {
      lastWeekCol = c;
      cols.push({ person, col: c, week: Number(wk[1]) });
    } else if (label.startsWith("remark") || label.startsWith("reamark")) {
      cols.push({ person, col: c, remarkFor: lastWeekCol });
    }
  }
  for (const p of new Set(cols.map((c) => c.person))) {
    const mine = cols.filter((c) => c.person === p);
    const weeks = new Map<number, Map<string, Entry>>();
    for (const c of mine.filter((x) => x.week)) {
      for (const k of kpis) {
        const v = num(ws.getCell(rowOf.get(k.name)!, c.col));
        if (v === null) continue;
        const rem = mine.find((x) => x.remarkFor === c.col);
        const remark = rem ? text(ws.getCell(rowOf.get(k.name)!, rem.col)) : "";
        const w = weeks.get(c.week!) ?? new Map<string, Entry>();
        w.set(key(k.name), { value: v, remark: remark && key(remark) !== "no issues" ? remark.slice(0, 500) : null });
        weeks.set(c.week!, w);
      }
    }
    if (weeks.size > 0) out.push({ who: p, period, template, source: `Team SHO · ${ws.name}`, kpis, weeks });
  }
  return out;
}

function parseIntern(ws: ExcelJS.Worksheet): Parsed[] {
  const kpis: (SheetKpi & { row: number })[] = [];
  let kra = "";
  for (let r = 3; r <= 18; r++) {
    const a = text(ws.getCell(r, 1));
    if (a) kra = a;
    const name = text(ws.getCell(r, 2));
    const max = num(ws.getCell(r, 3));
    if (name && max && max > 0) kpis.push({ name, kra, max, row: r });
  }
  const weeks = new Map<number, Map<string, Entry>>();
  let lastWeekCol = 0;
  const remarkOf = new Map<number, number>();
  const weekCols: { col: number; week: number }[] = [];
  for (let c = 4; c <= 11; c++) {
    const label = key(text(ws.getCell(2, c)));
    const wk = /^week\s*(\d)/.exec(label);
    if (wk) {
      lastWeekCol = c;
      weekCols.push({ col: c, week: Number(wk[1]) });
    } else if (label.startsWith("remark")) remarkOf.set(lastWeekCol, c);
  }
  for (const wc of weekCols) {
    for (const k of kpis) {
      const v = num(ws.getCell(k.row, wc.col));
      if (v === null) continue;
      const rc = remarkOf.get(wc.col);
      const remark = rc ? text(ws.getCell(k.row, rc)) : "";
      const w = weeks.get(wc.week) ?? new Map<string, Entry>();
      w.set(key(k.name), { value: v, remark: remark ? remark.slice(0, 500) : null });
      weeks.set(wc.week, w);
    }
  }
  return [{ who: "Swathi", period: month(2026, 6), template: "Internship Coordinator", source: "Team SHO · INTERNSHIP (June)", kpis, weeks }];
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const academic = new ExcelJS.Workbook();
  await academic.xlsx.readFile(FILES.academic);
  const sho = new ExcelJS.Workbook();
  await sho.xlsx.readFile(FILES.sho);

  const parsed: Parsed[] = [
    ...parseAcademic(academic),
    ...parseTeamTab(sho.getWorksheet("SHO")!, "SHO", month(2026, 7), 3, 16, 2),
    ...parseTeamTab(sho.getWorksheet("SEM")!, "SEM", month(2026, 7), 3, 21, 2),
    ...parseIntern(sho.getWorksheet("INTERNSHIP")!),
  ];

  // ── People and scorecards in Review ──────────────────────────────────
  const assignments = await db.perfAssignment.findMany({
    include: { employee: { select: { id: true, name: true } }, template: { select: { id: true, name: true } } },
  });
  const templates = await db.perfTemplate.findMany({ select: { id: true, name: true } });
  const templateId = new Map(templates.map((t) => [t.name, t.id]));

  interface Plan {
    p: Parsed;
    employeeId: string;
    employeeName: string;
    scorerUserId: string;
    how: "exact" | "partial";
    average: number | null;
    max: number;
    weeks: number;
    problems: string[];
  }
  const plans: Plan[] = [];
  const unmatched: string[] = [];
  for (const p of parsed) {
    const pool = assignments.filter((a) => a.template.name === p.template).map((a) => ({ name: a.employee.name, a }));
    const m = matchByName(p.who, pool);
    if (m.kind !== "exact" && m.kind !== "partial") {
      unmatched.push(`${p.who} (${p.template}, ${p.period.toISOString().slice(0, 7)}) — ${m.kind === "ambiguous" ? "more than one person fits" : "no one with that scorecard has that name"}`);
      continue;
    }
    const kpiDefs: KpiDef[] = p.kpis.map((k) => ({ id: key(k.name), kraId: k.kra, maxPoints: k.max, mode: "RATING" }));
    const problems: string[] = [];
    const weekRaw: RawScores[] = Array.from({ length: 5 }, () => ({}));
    for (const [w, entries] of p.weeks) {
      for (const [k, e] of entries) {
        const def = kpiDefs.find((d) => d.id === k);
        if (!def || e.value < 0 || e.value > def.maxPoints) {
          problems.push(`week ${w} “${k}” = ${e.value} is outside 0–${def?.maxPoints ?? "?"}; skipped`);
          entries.delete(k);
          continue;
        }
        weekRaw[w - 1][k] = e.value;
      }
    }
    const res = scoreMonth(kpiDefs, weekRaw);
    plans.push({
      p,
      employeeId: m.match.a.employee.id,
      employeeName: m.match.a.employee.name,
      scorerUserId: m.match.a.scorerUserId,
      how: m.kind,
      average: res.average,
      max: p.kpis.reduce((s, k) => s + k.max, 0),
      weeks: res.weeksScored,
      problems,
    });
  }

  // Existing data we must not overwrite.
  const existingScores = await db.perfScore.findMany({
    where: { employeeId: { in: plans.map((x) => x.employeeId) } },
    select: { employeeId: true, period: true },
  });
  const hasScores = new Set(existingScores.map((s) => `${s.employeeId}|${s.period.toISOString().slice(0, 7)}`));
  const existingReviews = await db.perfReview.findMany({
    where: { employeeId: { in: plans.map((x) => x.employeeId) } },
    select: { employeeId: true, period: true },
  });
  const hasReview = new Set(existingReviews.map((s) => `${s.employeeId}|${s.period.toISOString().slice(0, 7)}`));

  console.log("PERSON-MONTHS FOUND\n");
  for (const x of plans) {
    const ym = x.p.period.toISOString().slice(0, 7);
    const clash = hasScores.has(`${x.employeeId}|${ym}`);
    console.log(
      `${ym}  ${x.employeeName.padEnd(22)} ${x.p.template.padEnd(22)} weeks ${x.weeks}  avg ${x.average == null ? "—" : `${x.average} / ${x.max}`}` +
        `  [${x.p.source}${x.how === "partial" ? `; matched “${x.p.who}” by partial name` : ""}]${clash ? "  ← already has scores, will fill gaps only" : ""}`
    );
    for (const pr of x.problems) console.log(`          ! ${pr}`);
  }
  if (unmatched.length) {
    console.log(`\nNOT MATCHED — skipped (${unmatched.length}):`);
    for (const u of unmatched) console.log(`   - ${u}`);
  }

  const academicMonths = [...new Set(plans.filter((x) => x.p.template === "Academic Lead").map((x) => x.p.period.toISOString().slice(0, 7)))];
  console.log(`\nScorecard versions to add for Academic Lead (if absent): ${academicMonths.filter((m) => m !== "2026-08").join(", ") || "none"}`);
  console.log(`Total scores to write: ${plans.reduce((s, x) => s + [...x.p.weeks.values()].reduce((a, w) => a + w.size, 0), 0)}`);

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply.");
    return;
  }

  // ── Write ────────────────────────────────────────────────────────────
  const BATCH = 6;
  async function inBatches<T>(items: T[], run: (tx: Prisma.TransactionClient, item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += BATCH) {
      await db.$transaction(async (tx) => { for (const it of items.slice(i, i + BATCH)) await run(tx, it); }, { maxWait: 20_000, timeout: 120_000 });
      console.log(`  …${Math.min(i + BATCH, items.length)} / ${items.length}`);
    }
  }

  // Versions the sheets need (Academic Lead's June and July KPIs).
  for (const x of plans.filter((y) => y.p.template === "Academic Lead")) {
    const exact = await db.perfTemplateVersion.findUnique({
      where: { templateId_effectiveFrom: { templateId: templateId.get("Academic Lead")!, effectiveFrom: x.p.period } },
    });
    // This sheet has its own KPIs and weights for each month, so each month
    // needs a version of its own — an earlier month's being "in force" is not enough.
    if (exact) continue;
    const kras = [...new Set(x.p.kpis.map((k) => k.kra))];
    await db.perfTemplateVersion.create({
      data: {
        templateId: templateId.get("Academic Lead")!,
        effectiveFrom: x.p.period,
        kras: {
          create: kras.map((name, ki) => ({
            name,
            sortOrder: ki,
            kpis: { create: x.p.kpis.filter((k) => k.kra === name).map((k, pi) => ({ name: k.name, maxPoints: k.max, sortOrder: pi })) },
          })),
        },
      },
    });
    console.log(`  created Academic Lead scorecard from ${x.p.period.toISOString().slice(0, 7)}`);
  }

  await inBatches(plans, async (tx, x) => {
    const version = await tx.perfTemplateVersion.findFirst({
      where: { templateId: templateId.get(x.p.template)!, effectiveFrom: { lte: x.p.period } },
      orderBy: { effectiveFrom: "desc" },
      include: { kras: { include: { kpis: true } } },
    });
    if (!version) throw new Error(`No scorecard in force for ${x.p.template} ${x.p.period.toISOString().slice(0, 7)}`);
    const kpiId = new Map(version.kras.flatMap((k) => k.kpis).map((k) => [key(k.name), k.id]));
    const rows: Prisma.PerfScoreCreateManyInput[] = [];
    for (const [week, entries] of x.p.weeks) {
      for (const [name, e] of entries) {
        const id = kpiId.get(name);
        if (!id) { console.log(`   ! ${x.employeeName}: KPI “${name}” isn't on the ${x.p.template} scorecard; skipped`); continue; }
        rows.push({ employeeId: x.employeeId, kpiId: id, period: x.p.period, week, value: e.value, remark: e.remark, enteredById: x.scorerUserId, enteredByName: `Imported from HR sheet (${x.p.source})` });
      }
    }
    const created = await tx.perfScore.createMany({ data: rows, skipDuplicates: true });
    if (!hasReview.has(`${x.employeeId}|${x.p.period.toISOString().slice(0, 7)}`)) {
      const now = new Date();
      await tx.perfReview.create({
        data: {
          employeeId: x.employeeId, period: x.p.period, status: "CONFIRMED",
          submittedById: x.scorerUserId, submittedByName: "Imported from HR sheet", submittedAt: now,
          decidedById: x.scorerUserId, decidedByName: "Imported from HR sheet", decidedAt: now,
          finalScore: x.average, maxScore: x.max, weeksScored: x.weeks,
        },
      });
    }
    await writeAuditEvent(tx, {
      entityType: "PerfScore", entityId: x.employeeId, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null,
      after: { scores: created.count }, metadata: { source: "history-import", file: x.p.source, period: x.p.period.toISOString().slice(0, 7), employeeName: x.employeeName },
    });
  });
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
