/**
 * Web department history for August 2026, from the 7
 * "<Name>_August-2026_KRA_Report.csv" files in "New folder (1).zip". Each
 * is already in clean long format - one row per (KRA, KPI, week) - unlike
 * the September/October Word reports (seed-web-docx.ts), so this is a
 * straight CSV parse with no table-layout guessing. The same zip's
 * Sept/Oct CSVs are redundant with what seed-web-docx.ts already loaded
 * from the Word reports (verified: same people, same months) and are not
 * re-read here. No Arshad in this file - he only appears from October.
 *
 *   npx tsx prisma/seed-web-august.ts            # dry run
 *   npx tsx prisma/seed-web-august.ts --apply
 */
import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();
const PERIOD = new Date(Date.UTC(2026, 7, 1));
const DIR = "C:/Users/ASUS/AppData/Local/Temp/claude/webkpi-extract2/New folder/aug";

const FILES: { file: string; email: string; template: string }[] = [
  { file: "Shabeer_August-2026_KRA_Report.csv", email: "shabeerpk@harisand.co", template: "Web – Junior UI/UX Designer" },
  { file: "Dikra-Muneer_August-2026_KRA_Report (1).csv", email: "dikra@harisand.co", template: "Web – Junior Web Developer" },
  { file: "Manal-Abdul-Hameed-Mannil_August-2026_KRA_Report.csv", email: "manal@harisand.co", template: "Web – Content Writer" },
  { file: "Muhammed-Shifin_August-2026_KRA_Report.csv", email: "shifin@harisand.co", template: "Web – Junior Full Stack Developer" },
  { file: "Riya-Ummer-M-V_August-2026_KRA_Report.csv", email: "riya@harisand.co", template: "Web – Junior QA/QC Tester" },
  { file: "Shiju-KG_August-2026_KRA_Report.csv", email: "shiju@harisand.co", template: "Web – Senior UI/UX Designer" },
  { file: "Visakh-C-K_August-2026_KRA_Report.csv", email: "visakh@harisand.co", template: "Web – Senior Shopify Developer" },
];

const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Minimal CSV line splitter: handles quoted fields with embedded commas (no
// escaped quotes appear in this data, so a plain quote-toggle is enough).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

interface Row { kra: string; kpi: string; max: number; week: string; score: number }

function parseCsv(path: string): Row[] {
  const text = readFileSync(path, "utf-8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const [, , , kra, kpi, max, week, score] = cols;
    if (!kpi) continue;
    rows.push({ kra, kpi, max: Number(max), week, score: Number(score) });
  }
  return rows;
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");

  const employees = await db.employee.findMany({
    where: { email: { in: FILES.map((f) => f.email) } },
    select: { id: true, name: true, email: true, perfAssignment: { select: { templateId: true, scorerUserId: true } } },
  });
  const reviews = await db.perfReview.findMany({ select: { employeeId: true, period: true } });
  const done = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));
  const templates = await db.perfTemplate.findMany({ where: { name: { in: [...new Set(FILES.map((f) => f.template))] } }, include: { versions: { include: { kras: { include: { kpis: true } } } } } });
  const templateByName = new Map(templates.map((t) => [t.name, t]));

  for (const f of FILES) {
    const e = employees.find((x) => x.email.toLowerCase() === f.email.toLowerCase());
    if (!e || !e.perfAssignment) { console.log(`  ! ${f.email}: no Review employee/assignment; skipped`); continue; }
    const ym = "2026-08";
    if (done.has(`${e.id}|${ym}`)) { console.log(`  = ${e.name}: already recorded for ${ym}`); continue; }

    const rows = parseCsv(`${DIR}/${f.file}`);
    const weekDates = [...new Set(rows.map((r) => r.week))].sort();
    const kpiByKey = new Map<string, number>(); // keyOf(kpi) -> max
    for (const r of rows) kpiByKey.set(keyOf(r.kpi), r.max);

    const template = templateByName.get(f.template)!;
    const version = template.versions.filter((v) => +v.effectiveFrom <= +PERIOD).sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
    if (!version) { console.log(`  ! ${e.name}: no scorecard version in force for August; skipped`); continue; }
    const kpiId = new Map(version.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
    const maxScore = version.kras.reduce((s, k) => s + k.kpis.reduce((s2, x) => s2 + x.maxPoints, 0), 0);

    const scoreRows: Prisma.PerfScoreCreateManyInput[] = [];
    const weekTotals = new Map<string, number>();
    for (const r of rows) {
      const id = kpiId.get(keyOf(r.kpi));
      if (!id) { console.log(`  ! ${e.name}: KPI "${r.kpi}" has no match in the scorecard; row skipped`); continue; }
      const weekIndex = weekDates.indexOf(r.week) + 1;
      scoreRows.push({ employeeId: e.id, kpiId: id, period: PERIOD, week: weekIndex, value: r.score, remark: `Week of ${r.week}, imported from Web KRA CSV`, enteredById: e.perfAssignment.scorerUserId, enteredByName: "Imported from Web KRA CSV" });
      weekTotals.set(r.week, (weekTotals.get(r.week) ?? 0) + r.score);
    }
    const total = Math.round(([...weekTotals.values()].reduce((s, v) => s + v, 0) / weekTotals.size) * 100) / 100;

    if (!APPLY) {
      console.log(`  ${e.name.padEnd(22)} ${f.template.padEnd(32)} total=${total} weeks=${weekDates.length} scoreRows=${scoreRows.length} (expect ${kpiByKey.size}x${weekDates.length}=${kpiByKey.size * weekDates.length})`);
      continue;
    }

    const scorer = e.perfAssignment.scorerUserId;
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: scoreRows, skipDuplicates: true });
      await tx.perfReview.create({ data: { employeeId: e.id, period: PERIOD, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from Web KRA CSV", submittedAt: now, decidedById: scorer, decidedByName: "Imported from Web KRA CSV", decidedAt: now, finalScore: total, maxScore, weeksScored: weekDates.length } });
      await writeAuditEvent(tx, { entityType: "PerfReview", entityId: e.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { finalScore: total, scores: scoreRows.length }, metadata: { source: "web-august-csv-import", period: ym } });
    });
    console.log(`  recorded ${ym} ${e.name} = ${total} (${scoreRows.length} KPI scores across ${weekDates.length} weeks)`);
  }
  console.log(APPLY ? "\nDone." : "\nNothing was written. Re-run with --apply.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
