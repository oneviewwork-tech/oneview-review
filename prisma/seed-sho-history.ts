/**
 * SHO (Student Happiness Officer), Internship Coordinator and SEM (Student
 * Experience Manager) history for August and October 2026, from
 * "Team SHO - Performance Metrics - Aug.xlsx" and "...- OCT.xlsx" (sheets
 * "SHO" / "INTERNSHIP" / "SEM" in each). All three templates, and June/July
 * for most people, were already loaded in an earlier session - this adds
 * only what's new: August and October, plus Nashida and Rifa (both
 * resigned since, real history, needed a first-time assignment).
 *
 * Layout per sheet: KRA | KPI | Weight (%) meta columns, then one block
 * per person. August has "Remark" columns interleaved after some weeks
 * (irregular - detected from the label row, not a fixed stride); October
 * drops them, so each person is a clean 4-column block. The Total row has
 * no label in column 1 (just the KRA section ends and the next row holds
 * the week totals) - detected as the first all-blank-KRA row after the
 * last real KPI row.
 *
 * "Anupriya" (SHO, August only) has no match in People under any spelling
 * tried and is left out.
 *
 *   npx tsx prisma/seed-sho-history.ts            # dry run
 *   npx tsx prisma/seed-sho-history.ts --apply
 */
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();
const m = (mm: number) => new Date(Date.UTC(2026, mm, 1));

const SOURCES: { file: string; sheet: string; template: string; period: Date }[] = [
  { file: "C:/Users/ASUS/Downloads/_Team SHO - Performance Metrics  - Sept.xlsx", sheet: "SHO", template: "SHO", period: m(8) },
  { file: "C:/Users/ASUS/Downloads/_Team SHO - Performance Metrics  - Sept.xlsx", sheet: "INTERNSHIP", template: "Internship Coordinator", period: m(8) },
  { file: "C:/Users/ASUS/Downloads/_Team SHO - Performance Metrics  - Sept.xlsx", sheet: "SEM", template: "SEM", period: m(8) },
  { file: "C:/Users/ASUS/Downloads/Team SHO - Performance Metrics  - Aug.xlsx", sheet: "SHO", template: "SHO", period: m(7) },
  { file: "C:/Users/ASUS/Downloads/Team SHO - Performance Metrics  - Aug.xlsx", sheet: "INTERNSHIP", template: "Internship Coordinator", period: m(7) },
  { file: "C:/Users/ASUS/Downloads/Team SHO - Performance Metrics  - Aug.xlsx", sheet: "SEM", template: "SEM", period: m(7) },
  { file: "C:/Users/ASUS/Downloads/Team SHO - Performance Metrics  - OCT.xlsx", sheet: "SHO", template: "SHO", period: m(9) },
  { file: "C:/Users/ASUS/Downloads/Team SHO - Performance Metrics  - OCT.xlsx", sheet: "INTERNSHIP", template: "Internship Coordinator", period: m(9) },
  { file: "C:/Users/ASUS/Downloads/Team SHO - Performance Metrics  - OCT.xlsx", sheet: "SEM", template: "SEM", period: m(9) },
];

const ALIAS: Record<string, string> = {
  rinu: "rinu@harisandcoacademy.com",
  keerthana: "keerthana@harisandcoacademy.com",
  aysha: "ayshahaneena@harisandcoacademy.com", // "Aysha Haneena" - the only "Aysha" column in these sheets
  sanika: "sanika@harisandcoacademy.com",
  devika: "devika@harisandcoacademy.com",
  rifa: "rifa@harisandcoacademy.com",
  nashida: "nashida@harisandcoacademy.com",
  swathi: "swathi@harisandcoacademy.com",
  shahana: "shahana@harisandcoacademy.com",
  nidha: "nidhap@harisandcoacademy.com",
  fathima: "fathimafidamv@harisandcoacademy.com", // September's "FATHIMA FIDHA" column - already has an SHO assignment
  abhishna: "abhishnacp@harisandcoacademy.com", // September's "ABHISHNA" column, a different Review employee from Tech School's Abishna CK - already has an SHO assignment
};
const UNRESOLVED = new Set(["anupriya"]);

type Cell = ExcelJS.Cell;
const text = (c: Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

interface Block { name: string; weekCols: number[] }
interface MonthPlan { template: string; period: Date; personFirst: string; weeks: Map<string, number>[]; weekTotals: number[] }

function findBlocks(ws: ExcelJS.Worksheet): Block[] {
  const nameRow = ws.getRow(1), labelRow = ws.getRow(2);
  const blocks: Block[] = [];
  let c = 4;
  while (c <= ws.columnCount) {
    const name = text(nameRow.getCell(c));
    if (!name) { c++; continue; }
    const weekCols: number[] = [];
    let cc = c;
    while (cc <= ws.columnCount && text(nameRow.getCell(cc)) === name) {
      if (/^week/i.test(text(labelRow.getCell(cc)))) weekCols.push(cc);
      cc++;
    }
    blocks.push({ name, weekCols });
    c = cc;
  }
  return blocks;
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const plans: MonthPlan[] = [];
  const kpiCache = new Map<string, { kra: string; name: string; row: number }[]>();

  for (const src of SOURCES) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(src.file);
    const ws = wb.getWorksheet(src.sheet);
    if (!ws) { console.log(`  ! ${src.sheet} not found in ${src.file.split("/").pop()}`); continue; }

    let kpis = kpiCache.get(src.template);
    let firstBlankRow = -1;
    if (!kpis) {
      kpis = [];
      for (let r = 3; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const kra = text(row.getCell(1)), kpi = text(row.getCell(2));
        if (!kpi) { firstBlankRow = r; break; } // the row right after the last real KPI row
        kpis.push({ kra: kra || kpis.at(-1)?.kra || "", name: kpi, row: r });
      }
      kpiCache.set(src.template, kpis);
    } else {
      for (let r = 3; r <= ws.rowCount; r++) { if (!text(ws.getRow(r).getCell(2))) { firstBlankRow = r; break; } }
    }
    if (firstBlankRow < 0) { console.log(`  ! ${src.sheet} in ${src.file.split("/").pop()}: no total row found; skipped`); continue; }

    for (const b of findBlocks(ws)) {
      const nameOnly = b.name.includes(":") ? b.name.split(":")[1] : b.name; // "Employee Name : Swathi(June)" -> "Swathi(June)"
      const first = keyOf(nameOnly.replace(/\(.*/, "")).split(" ")[0];
      if (UNRESOLVED.has(first)) continue;
      const weeks: Map<string, number>[] = [];
      const weekTotals: number[] = [];
      for (const col of b.weekCols) {
        // The total row isn't always the same for every person's block in
        // a sheet (a stray empty "Total" label row sits before the real
        // numbers for some), and the exact week column can shift by one
        // when "Remark" columns interleave inconsistently - search this
        // person's own week column (and the one right after it, in case
        // the total landed in the Remark slot instead) across a few rows
        // from firstBlankRow for the first real number.
        let total: number | null = null;
        for (let r = firstBlankRow; r <= Math.min(ws.rowCount, firstBlankRow + 3) && total == null; r++) {
          total = num(text(ws.getRow(r).getCell(col))) ?? num(text(ws.getRow(r).getCell(col + 1)));
        }
        if (total == null) continue;
        const perKpi = new Map<string, number>();
        for (const k of kpis) {
          const v = num(text(ws.getRow(k.row).getCell(col)));
          if (v != null) perKpi.set(keyOf(k.name), v);
        }
        weeks.push(perKpi);
        weekTotals.push(total);
      }
      if (!weeks.length) continue;
      plans.push({ template: src.template, period: src.period, personFirst: first, weeks, weekTotals });
    }
  }

  const employees = await db.employee.findMany({
    where: { email: { in: [...new Set(Object.values(ALIAS))] } },
    select: { id: true, name: true, email: true, perfAssignment: { select: { id: true, templateId: true, scorerUserId: true, template: { select: { name: true } } } } },
  });

  // Nashida and Rifa (both SHO, resigned) have no assignment yet. Give them
  // the same scorer as their still-assigned SHO peers (Devika's, since
  // People's own manager chain for a resigned employee is often stale).
  const peer = employees.find((e) => e.perfAssignment?.template.name === "SHO");
  const shoTemplate = await db.perfTemplate.findFirst({ where: { name: "SHO" }, select: { id: true } });
  for (const name of ["nashida", "rifa"]) {
    const e = employees.find((x) => x.email.toLowerCase() === ALIAS[name].toLowerCase());
    if (!e) { console.log(`  ! ${name}: no Review employee`); continue; }
    if (e.perfAssignment) continue;
    if (!peer?.perfAssignment) { console.log(`  ! ${name}: no SHO peer to copy a scorer from`); continue; }
    console.log(`  + assign ${e.name} -> SHO, scored by the same person as ${peer.name}`);
    if (APPLY) await db.perfAssignment.create({ data: { employeeId: e.id, templateId: shoTemplate!.id, scorerUserId: peer.perfAssignment.scorerUserId } });
  }

  if (!APPLY) {
    console.log("\n--- Plans found (dry run) ---");
    const byPerson = new Map<string, MonthPlan[]>();
    for (const p of plans) { const k = `${p.template}/${p.personFirst}`; if (!byPerson.has(k)) byPerson.set(k, []); byPerson.get(k)!.push(p); }
    for (const [key, rows] of byPerson) {
      rows.sort((a, b) => +a.period - +b.period);
      console.log(`  ${key.padEnd(28)} ${rows.map((r) => `${r.period.toISOString().slice(0, 7)}=${Math.round((r.weekTotals.reduce((s, v) => s + v, 0) / r.weekTotals.length) * 100) / 100}(${r.weeks.length}wk)`).join("  ")}`);
    }
    return console.log("\nNothing was written. Re-run with --apply.");
  }

  const employees2 = await db.employee.findMany({ where: { email: { in: [...new Set(Object.values(ALIAS))] } }, select: { id: true, name: true, email: true, perfAssignment: { select: { templateId: true, scorerUserId: true } } } });
  const reviews = await db.perfReview.findMany({ select: { employeeId: true, period: true } });
  const done = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));
  const templates = await db.perfTemplate.findMany({ where: { name: { in: ["SHO", "Internship Coordinator", "SEM"] } }, include: { versions: { include: { kras: { include: { kpis: true } } } } } });
  const templateByName = new Map(templates.map((t) => [t.name, t]));

  for (const p of plans) {
    const email = ALIAS[p.personFirst];
    const e = employees2.find((x) => x.email.toLowerCase() === email?.toLowerCase());
    if (!e || !e.perfAssignment) { console.log(`  ! ${p.personFirst}: no assignment; skipped ${p.period.toISOString().slice(0, 7)}`); continue; }
    const ym = p.period.toISOString().slice(0, 7);
    if (done.has(`${e.id}|${ym}`)) continue;
    const template = templateByName.get(p.template)!;
    const version = template.versions.filter((v) => +v.effectiveFrom <= +p.period).sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
    if (!version) { console.log(`  ! ${e.name} ${ym}: no version in force; skipped`); continue; }
    const kpiId = new Map(version.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
    const maxScore = version.kras.reduce((s, k) => s + k.kpis.reduce((s2, x) => s2 + x.maxPoints, 0), 0);
    const total = Math.round((p.weekTotals.reduce((s, v) => s + v, 0) / p.weekTotals.length) * 100) / 100;
    const scorer = e.perfAssignment.scorerUserId;
    const now = new Date();
    const scoreRows: Prisma.PerfScoreCreateManyInput[] = p.weeks.flatMap((weekKpis, i) =>
      [...weekKpis.entries()].flatMap(([key, value]) => {
        const id = kpiId.get(key);
        return id ? [{ employeeId: e.id, kpiId: id, period: p.period, week: i + 1, value, remark: `Imported from ${p.template} sheet`, enteredById: scorer, enteredByName: "Imported from SHO sheet" }] : [];
      }),
    );
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: scoreRows, skipDuplicates: true });
      await tx.perfReview.create({ data: { employeeId: e.id, period: p.period, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from SHO sheet", submittedAt: now, decidedById: scorer, decidedByName: "Imported from SHO sheet", decidedAt: now, finalScore: total, maxScore, weeksScored: p.weeks.length } });
      await writeAuditEvent(tx, { entityType: "PerfReview", entityId: e.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { finalScore: total, scores: scoreRows.length }, metadata: { source: "sho-history-import", period: ym, template: p.template } });
    });
    console.log(`  recorded ${ym} ${e.name} (${p.template}) = ${total} (${scoreRows.length} KPI scores across ${p.weeks.length} weeks)`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
