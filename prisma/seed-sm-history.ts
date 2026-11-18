/**
 * Social Media department history from the 5 role workbooks Nabil sent
 * ("KPI KRA SM WRITERS", "KRA KPI SM Production", "KRA KPI SM MANAGERS",
 * "KPI KRA - LEADS", "KPI KRA  Design TEAM"). This is the department's
 * first-ever recorded history — no PerfReview/PerfScore rows exist for it
 * yet.
 *
 * Layout (shared by all 5, header row position varies by +0/+1): metadata
 * columns (KRA/KPI/Metric, or Category/KRA/KPI/Metric for LEADS) then one
 * 8-column block per person = 4 weeks x 2 columns (a raw per-KPI score, and
 * a column holding that KPI's weighted contribution toward its KRA's point
 * allocation - the same value repeats down every KPI row of one KRA group).
 * The raw score (the first column of each week's pair) is what gets stored
 * as that week's PerfScore for the matching KPI - matched to the person's
 * own scorecard version by KPI name, not by position, since a sheet's KPI
 * order doesn't always match the scorecard's. Rows after the KPI rows: a
 * "Total" row (pre-deduction KRA total), a Critical/penalty KPI section,
 * then one or two more "Total" rows (the post-deduction total, when a
 * penalty applied that week). The month's PerfReview.finalScore is the
 * average of the LAST non-empty Total row's value per populated week (the
 * post-deduction total when present, else the pre-deduction one) - not
 * re-derived from the penalty rows, whose layout repeats one combined
 * figure per category rather than one value per category, which would
 * double count.
 *
 * Matches people by the sheet's first name against the Social Media /
 * Marketing roster in People, reusing each existing Review assignment's
 * scorecard and scorer. A sheet name with no People match, or whose person
 * has no Review assignment yet, is reported and skipped - never guessed.
 *
 *   npx tsx prisma/seed-sm-history.ts            # dry run
 *   npx tsx prisma/seed-sm-history.ts --apply
 */
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();

const DL = "C:/Users/ASUS/Downloads/";
const FILES: { path: string; months: [string, Date][] }[] = [
  {
    path: `${DL}KPI KRA SM WRITERS.xlsx`,
    months: [["June 2026", m(5)], ["July 2026", m(6)], ["Aug 2026", m(7)], ["September 2026", m(8)], ["October 2026", m(9)]],
  },
  {
    path: `${DL}KRA KPI SM Production.xlsx`,
    months: [["June 2026", m(5)], ["July 2026", m(6)], ["September  2026", m(8)], ["October 2026", m(9)]],
  },
  {
    // Fairuza's own block here is irregular (cols repeat one value across
    // what should be 4 distinct weeks - see KPI KRA - LEADS.xlsx instead,
    // which carries her cleanly under the "Social Media Lead" sheet name),
    // so her column is excluded from this file and read from LEADS only.
    path: `${DL}KRA KPI SM MANAGERS.xlsx`,
    months: [["April 2026", m(3)], ["May 2026", m(4)], ["June 2026", m(5)], ["July 2026", m(6)], ["Aug 2026", m(7)], ["September 2026", m(8)], ["October 2026", m(9)]],
  },
  {
    path: `${DL}KPI KRA - LEADS.xlsx`,
    months: [["June 2026", m(5)], ["July 2026", m(6)], ["Aug 2026", m(7)], ["September 2026", m(8)], ["October 2026", m(9)]],
  },
  {
    path: `${DL}KPI KRA  Design TEAM.xlsx`,
    months: [["July 2026", m(6)], ["September 2026", m(8)], ["October 2026", m(9)]],
  },
];

// Sheet first name -> People official email. "fairu" / Leads' sole person
// is Fairuza, already on "Social Media - Production Head" in Review; the
// Leads title ("Social Media Lead") is that same role under a different
// sheet name, not a second scorecard. Resigned people are history-only:
// they get PerfReview rows but no new assignment.
const ALIAS: Record<string, string> = {
  naabil: "nabil@harisand.co",
  jithin: "jithinraj@harisand.co",
  fairu: "fairu@harisand.co",
  amal: "amalshamsudheen@harisand.co",
  nafisa: "nafisa@harisand.co",
  nikhil: "nikhil@harisand.co",
  navaneeth: "navneethsurendran@harisand.co", // sheet spelling vs People's "Navneeth S"
  suhail: "suhail@harisand.co", // Social Media's Suhail M T, not HACA's Ameer Suhail
};
// No match in People under any spelling tried; left out of this load.
const UNRESOLVED = new Set(["ashika", "ilham", "adhyth", "lakshmi"]);

function m(mm: number) { return new Date(Date.UTC(2026, mm, 1)); }

type Cell = ExcelJS.Cell;
const text = (c: Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sig = (k: { kra: string; name: string; max: number }[]) => k.map((x) => `${keyOf(x.name)}=${Math.round(x.max * 100) / 100}`).sort().join(";");

interface Block { name: string; firstCol: number }
interface MonthPlan {
  file: string; sheet: string; period: Date; personFirstName: string; firstCol: number;
  /** One per populated week: that week's per-KPI raw scores, keyed by keyOf(kpiName). */
  weeks: Map<string, number>[];
  /** That week's Total-row value (post-deduction when present), parallel to `weeks`. */
  weekTotals: number[];
}

function findHeaderRow(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= 5; r++) {
    const row = ws.getRow(r);
    if (/^kra$/i.test(text(row.getCell(1))) || /^kra$/i.test(text(row.getCell(2)))) return r;
  }
  throw new Error("no KRA/KPI header row found in first 5 rows");
}

function findBlocks(ws: ExcelJS.Worksheet, nameRow: number, metaCols: number): Block[] {
  const row = ws.getRow(nameRow);
  const blocks: Block[] = [];
  let c = metaCols + 1;
  while (c <= ws.columnCount) {
    const name = text(row.getCell(c));
    if (name && name !== "?") blocks.push({ name, firstCol: c });
    c += 8;
  }
  return blocks;
}

async function parseFile(file: string, months: [string, Date][]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const plans: MonthPlan[] = [];
  for (const [sheetName, period] of months) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(`  ! ${file.split("/").pop()} :: "${sheetName}" not found`); continue; }
    const headerRow = findHeaderRow(ws);
    const metaCols = /^category$/i.test(text(ws.getRow(headerRow).getCell(1))) ? 4 : 3;
    const blocks = findBlocks(ws, headerRow, metaCols);

    // KPI rows run from headerRow+2 (skipping the Week-label row) down to
    // the first "Total" row; everything after is the Critical section and
    // further Totals, bounded by scanning until two consecutive Totals end it.
    const kpis: { kra: string; name: string; max: number; row: number }[] = [];
    let firstTotalRow = -1;
    for (let r = headerRow + 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const kra = text(row.getCell(1)), kpiCol = metaCols === 4 ? 3 : 2, kpi = text(row.getCell(kpiCol));
      if (/^total$/i.test(kra)) { firstTotalRow = r; break; }
      if (kra && kpi) kpis.push({ kra, name: kpi, max: 0, row: r });
    }
    if (firstTotalRow < 0) { console.log(`  ! ${sheetName}: no Total row found; skipped`); continue; }
    // Collect every "Total" row from firstTotalRow onward (pre- and any
    // post-deduction ones), stopping once a non-Total/non-Critical KRA
    // label reappears (defensive; sheets end at EOF or the next section).
    const totalRows: number[] = [];
    for (let r = firstTotalRow; r <= Math.min(ws.rowCount, firstTotalRow + 10); r++) {
      if (/^total$/i.test(text(ws.getRow(r).getCell(1)))) totalRows.push(r);
    }

    for (const b of blocks) {
      const first = keyOf(b.name).split(" ")[0];
      if (UNRESOLVED.has(first)) continue;
      if (first === "fairu" && /SM MANAGERS/i.test(file)) continue; // irregular columns here; use LEADS instead
      const weeks: Map<string, number>[] = [];
      const weekTotals: number[] = [];
      for (let w = 0; w < 4; w++) {
        const col = b.firstCol + w * 2;
        let total: number | null = null;
        for (let i = totalRows.length - 1; i >= 0; i--) {
          const got = num(text(ws.getRow(totalRows[i]).getCell(col)));
          if (got != null) { total = got; break; }
        }
        if (total == null) continue; // blank week
        const perKpi = new Map<string, number>();
        for (const k of kpis) {
          const v = num(text(ws.getRow(k.row).getCell(col)));
          if (v != null) perKpi.set(keyOf(k.name), v);
        }
        weeks.push(perKpi);
        weekTotals.push(total);
      }
      if (!weeks.length) continue; // blank block for this month
      plans.push({ file, sheet: sheetName, period, personFirstName: first, firstCol: b.firstCol, weeks, weekTotals });
    }
  }
  return plans;
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");

  const allPlans: MonthPlan[] = [];
  for (const f of FILES) {
    console.log(`\n== ${f.path.split("/").pop()} ==`);
    allPlans.push(...(await parseFile(f.path, f.months)));
  }

  // Resolve each sheet first name to a Review employee via People. HR often
  // enters a generic given name (Muhammed/Mohammed/Muhammad) as firstName
  // and the name people actually go by as lastName, so both are indexed.
  const people = await db.$queryRaw<{ id: string; firstName: string; lastName: string; email: string; status: string }[]>`
    SELECT e."id", lower(e."firstName") AS "firstName", lower(e."lastName") AS "lastName", lower(coalesce(u."email", e."officialEmail")) AS "email", e."employmentStatus"::text AS "status"
    FROM "public"."Employee" e LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    WHERE e."archivedAt" IS NULL`;
  const employees = await db.employee.findMany({
    select: {
      id: true, name: true, email: true, peopleEmployeeId: true,
      perfAssignment: {
        select: {
          templateId: true, scorerUserId: true,
          template: { select: { name: true, versions: { select: { id: true, effectiveFrom: true, kras: { select: { name: true, kpis: { select: { id: true, name: true, maxPoints: true } } } } } } } },
        },
      },
    },
  });
  const reviews = await db.perfReview.findMany({ select: { employeeId: true, period: true } });
  const done = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));

  // Index by every name word (first or last), preferring an ACTIVE/ON_NOTICE
  // person over a resigned one when a word is ambiguous between two people.
  const byFirst = new Map<string, { email: string; status: string }>();
  for (const p of people) {
    for (const word of [...p.firstName.split(" "), ...p.lastName.split(" ")]) {
      if (!word) continue;
      const existing = byFirst.get(word);
      const active = p.status === "ACTIVE" || p.status === "ON_NOTICE";
      if (!existing || (active && existing.status !== "ACTIVE" && existing.status !== "ON_NOTICE")) {
        byFirst.set(word, { email: p.email, status: p.status });
      } else if (existing && active && (existing.status === "ACTIVE" || existing.status === "ON_NOTICE") && existing.email !== p.email) {
        byFirst.set(word, { email: "__AMBIGUOUS__", status: p.status });
      }
    }
  }

  const ready: { e: (typeof employees)[number]; period: Date; total: number; weeks: Map<string, number>[]; file: string }[] = [];
  const unresolved = new Set<string>();
  const ambiguous = new Set<string>();
  const seenThisRun = new Set<string>(); // employeeId|yyyy-mm already queued, so the same person/month from two files isn't recorded twice

  for (const p of allPlans) {
    const hit = ALIAS[p.personFirstName] ? { email: ALIAS[p.personFirstName], status: "ACTIVE" } : byFirst.get(p.personFirstName);
    if (!hit) { unresolved.add(p.personFirstName); continue; }
    if (hit.email === "__AMBIGUOUS__") { ambiguous.add(p.personFirstName); continue; }
    const e = employees.find((x) => x.email.toLowerCase() === hit.email.toLowerCase());
    if (!e || !e.perfAssignment) { console.log(`  ! ${p.personFirstName} <${hit.email}>: no Review employee/assignment; skipped (${p.file.split("/").pop()} ${p.sheet})`); continue; }
    const ym = p.period.toISOString().slice(0, 7);
    const key = `${e.id}|${ym}`;
    if (done.has(key) || seenThisRun.has(key)) continue;
    seenThisRun.add(key);
    const avg = Math.round((p.weekTotals.reduce((s, v) => s + v, 0) / p.weekTotals.length) * 100) / 100;
    ready.push({ e, period: p.period, total: avg, weeks: p.weeks, file: p.file.split("/").pop()! });
  }

  console.log("\n--- Resolved months ready to record ---");
  const byPerson = new Map<string, typeof ready>();
  for (const r of ready) { const k = r.e.name; if (!byPerson.has(k)) byPerson.set(k, []); byPerson.get(k)!.push(r); }
  for (const [name, rows] of byPerson) {
    rows.sort((a, b) => +a.period - +b.period);
    console.log(`  ${name.padEnd(22)} ${rows.map((r) => `${r.period.toISOString().slice(0, 7)}=${r.total}(${r.weeks.length}wk)`).join("  ")}`);
  }

  if (unresolved.size) console.log("\n--- No People match (left out) ---\n  " + [...unresolved].join(", "));
  if (ambiguous.size) console.log("\n--- Ambiguous name, two active People match (left out) ---\n  " + [...ambiguous].join(", "));

  console.log(`\n${ready.length} employee-months ready across ${byPerson.size} people.`);
  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  for (const r of ready) {
    const version = r.e.perfAssignment!.template.versions.filter((v) => +v.effectiveFrom <= +r.period).sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
    if (!version) { console.log(`  ! ${r.e.name} ${r.period.toISOString().slice(0, 7)}: no scorecard version in force; skipped`); continue; }
    const maxScore = version.kras.reduce((s, k) => s + k.kpis.reduce((s2, x) => s2 + x.maxPoints, 0), 0);
    const kpiId = new Map(version.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
    const scorer = r.e.perfAssignment!.scorerUserId;
    const now = new Date();
    const scoreRows: Prisma.PerfScoreCreateManyInput[] = r.weeks.flatMap((weekKpis, i) =>
      [...weekKpis.entries()].flatMap(([key, value]) => {
        const id = kpiId.get(key);
        return id ? [{ employeeId: r.e.id, kpiId: id, period: r.period, week: i + 1, value, remark: "Imported from Social Media sheet", enteredById: scorer, enteredByName: "Imported from SM sheet" }] : [];
      }),
    );
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: scoreRows, skipDuplicates: true });
      await tx.perfReview.create({ data: { employeeId: r.e.id, period: r.period, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from SM sheet", submittedAt: now, decidedById: scorer, decidedByName: "Imported from SM sheet", decidedAt: now, finalScore: r.total, maxScore, weeksScored: r.weeks.length } });
      await writeAuditEvent(tx, { entityType: "PerfReview", entityId: r.e.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { finalScore: r.total, scores: scoreRows.length }, metadata: { source: "sm-history-import", period: r.period.toISOString().slice(0, 7), file: r.file } });
    });
    console.log(`  recorded ${r.period.toISOString().slice(0, 7)} ${r.e.name} = ${r.total} (${scoreRows.length} KPI scores across ${r.weeks.length} weeks)`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
