/**
 * Tech School mentors' June-October 2026 history from
 * "Mentors KPA - KRI - Tech School.xlsx". Nothing was loaded for this
 * department before this.
 *
 * June-September use the existing "Mentor" PerfTemplate as-is (16 KPIs,
 * max 100 - this sheet's structure matches it exactly, unlike Design
 * School's sheet which needed its own template). October switches to a
 * completely different 5-KRA structure (30/20/20/20/10, max 100) with no
 * individual KPI rows - just one row per KRA - so it gets its own version.
 *
 * People: Hamna, Hiba (= Ayisha Hiba V, whose Review record already sits
 * in the Tech School department despite People tagging her "Academics" -
 * a different Fathima Hiba in Marketing is NOT her), Radhika, Rasmina,
 * Sajfar (RESIGNED - history only), Hanna, Nidhin, Abishna/Abhishna
 * (spelling drifts between months, same person), Fathima Beevi, Safva
 * (Sept-Oct only). "Jalal" and "Mustaq" (June only) have no match in
 * People under any spelling tried and are left out.
 *
 *   npx tsx prisma/seed-tech-mentors.ts            # dry run
 *   npx tsx prisma/seed-tech-mentors.ts --apply
 */
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();
const FILE = "C:/Users/ASUS/Downloads/Mentors KPA - KRI - Tech School.xlsx";
const m = (mm: number) => new Date(Date.UTC(2026, mm, 1));
const MONTHS: [string, Date, "old" | "new"][] = [["June", m(5), "old"], ["July", m(6), "old"], ["Aug", m(7), "old"], ["Sept", m(8), "old"], ["Oct", m(9), "new"]];
// The sheet's people are split across two Review departments: Hamna,
// Radhika, Rasmina and Sajfar sit in "Tech School" itself, while Hanna,
// Nidhin, Abishna, Fathima Beevi and Safva sit in "Academics" (Review
// hasn't re-synced their department since People moved them). Looked up
// by the ALIAS emails directly rather than one department id.

const ALIAS: Record<string, string> = {
  hamna: "hamnak@harisandcoacademy.com",
  hiba: "hiba@harisandcoacademy.com", // Ayisha Hiba V, the Tech School one
  radhika: "radhikaek@harisandcoacademy.com",
  rasmina: "rasmina@harisandcoacademy.com",
  sajfar: "muhammadsajfarm@harisandcoacademy.com",
  hanna: "hanna@harisandcoacademy.com",
  nidhin: "nidhin@harisandcoacademy.com",
  abhishna: "abishna@harisandcoacademy.com",
  abishna: "abishna@harisandcoacademy.com",
  fathima: "fathimabeevi@harisandcoacademy.com", // "Fathima Beevi" sheet column, first word only
  safva: "safva@harisandcoaacdemy.com", // Review's own employee record has this typo'd domain, not People's correct one
};
const UNRESOLVED = new Set(["jalal", "mustaq", "shifa"]); // "shifa" (July): no People match under any spelling tried

type Cell = ExcelJS.Cell;
const text = (c: Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

interface Block { name: string; firstCol: number }
interface MonthPlan { period: Date; shape: "old" | "new"; personFirst: string; weeks: Map<string, number>[]; weekTotals: number[] }

function findBlocks(ws: ExcelJS.Worksheet, metaCols: number): Block[] {
  const row = ws.getRow(1);
  const blocks: Block[] = [];
  let c = metaCols + 1;
  while (c <= ws.columnCount) {
    const name = text(row.getCell(c));
    if (name) blocks.push({ name, firstCol: c });
    c += 4;
  }
  return blocks;
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  // "old" shape KPI rows (from June, metaCols=4: KRA|KPI|Metric|Weight).
  const wsOld = wb.getWorksheet("June")!;
  const oldKpis: { kra: string; name: string; max: number; row: number }[] = [];
  let oldTotalRow = -1;
  for (let r = 3; r <= wsOld.rowCount; r++) {
    const row = wsOld.getRow(r);
    const kra = text(row.getCell(1)), kpi = text(row.getCell(2)), w = num(text(row.getCell(4)));
    if (/^total$/i.test(kra)) { oldTotalRow = r; break; }
    if (kra && kpi && w != null) oldKpis.push({ kra, name: kpi, max: w, row: r });
  }
  console.log(`"old" shape KPIs (June): ${oldKpis.length}, max ${oldKpis.reduce((s, k) => s + k.max, 0)}`);

  // "new" shape (October, metaCols=3: KRA|What to Measure|Weight, one row per KRA).
  const wsNew = wb.getWorksheet("Oct")!;
  const newKpis: { kra: string; name: string; max: number; row: number }[] = [];
  let newTotalRow = -1;
  for (let r = 3; r <= wsNew.rowCount; r++) {
    const row = wsNew.getRow(r);
    const kra = text(row.getCell(1)), w = num(text(row.getCell(3)));
    if (/^total/i.test(kra)) { newTotalRow = r; break; }
    if (kra && w != null) newKpis.push({ kra, name: kra, max: w, row: r });
  }
  console.log(`"new" shape KRAs (Oct): ${newKpis.length}, max ${newKpis.reduce((s, k) => s + k.max, 0)}`);

  const plans: MonthPlan[] = [];
  for (const [sheetName, period, shape] of MONTHS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(`  ! ${sheetName}: not found`); continue; }
    const metaCols = shape === "old" ? 4 : 3;
    const kpis = shape === "old" ? oldKpis : newKpis;
    let tRow = shape === "old" ? oldTotalRow : newTotalRow;
    for (let r = 3; r <= ws.rowCount; r++) if (/^total/i.test(text(ws.getRow(r).getCell(1)))) { tRow = r; break; }
    // "new" shape has two Total rows (one rounded, one exact); prefer the last.
    const totalRows: number[] = [];
    for (let r = tRow; r <= Math.min(ws.rowCount, tRow + 3); r++) if (/^total/i.test(text(ws.getRow(r).getCell(1)))) totalRows.push(r);

    for (const b of findBlocks(ws, metaCols)) {
      const first = keyOf(b.name).split(" ")[0];
      if (UNRESOLVED.has(first)) continue;
      const weeks: Map<string, number>[] = [];
      const weekTotals: number[] = [];
      for (let w = 0; w < 4; w++) {
        const col = b.firstCol + w;
        let total: number | null = null;
        for (let i = totalRows.length - 1; i >= 0; i--) {
          const got = num(text(ws.getRow(totalRows[i]).getCell(col)));
          if (got != null) { total = got; break; }
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
      plans.push({ period, shape, personFirst: first, weeks, weekTotals });
    }
  }

  const employees = await db.employee.findMany({
    where: { email: { in: [...new Set(Object.values(ALIAS))] } },
    select: { id: true, name: true, email: true, perfAssignment: { select: { id: true, templateId: true, scorerUserId: true } } },
  });

  let template = await db.perfTemplate.findFirst({ where: { name: "Mentor" }, include: { versions: { include: { kras: { include: { kpis: true } } } } } });
  const hasNewVersion = template!.versions.some((v) => v.effectiveFrom.toISOString().slice(0, 7) === "2026-10");
  if (!hasNewVersion) {
    console.log(`\n+ add "Mentor" version from 2026-10 (${newKpis.length} KRAs as KPIs, max ${newKpis.reduce((s, k) => s + k.max, 0)})`);
    if (APPLY) {
      await db.perfTemplateVersion.create({
        data: { templateId: template!.id, effectiveFrom: m(9), kras: { create: newKpis.map((k, i) => ({ name: k.kra, sortOrder: i, kpis: { create: [{ name: k.name, maxPoints: k.max, sortOrder: 0 }] } })) } },
      });
    }
  } else {
    console.log(`\n= "Mentor" already has an October version`);
  }

  // Assignments: give Hamna/Radhika/Sajfar/Hiba/Safva the template if missing.
  const scorerLookup = await db.$queryRaw<{ email: string; scorerEmail: string | null; scorerName: string | null }[]>`
    SELECT lower(coalesce(u."email", e."officialEmail")) AS email, lower(coalesce(tu."email", t."officialEmail", mu."email", m."officialEmail")) AS "scorerEmail",
           trim(coalesce(t."firstName" || ' ' || t."lastName", m."firstName" || ' ' || m."lastName")) AS "scorerName"
    FROM "public"."Employee" e LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId" LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId" LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"
    WHERE lower(coalesce(u."email", e."officialEmail")) = ANY(${[...new Set(Object.values(ALIAS))]})`;
  const scorerByEmail = new Map(scorerLookup.map((s) => [s.email, s]));
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  // People's own dottedLine/reportingManager for Hamna and Radhika is Ashar,
  // whose Review login was deliberately deleted in an earlier session (the
  // user's submitter list was authoritative and had zero submissions under
  // him) - Rasmina's existing Tech School assignment already uses Neha as
  // scorer instead, so new assignments here follow that same precedent.
  const NEHA_USER_ID = userByEmail.get("neha@harisandcoacademy.com");
  for (const [first, email] of Object.entries(ALIAS)) {
    if (first === "abhishna") continue; // same person as "abishna", skip duplicate alias
    const e = employees.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!e) { console.log(`  ! ${first} <${email}>: no Review employee`); continue; }
    if (e.perfAssignment) continue;
    const scorer = scorerByEmail.get(email);
    const viaManager = scorer?.scorerEmail ? userByEmail.get(scorer.scorerEmail) : undefined;
    const scorerUserId = viaManager ?? NEHA_USER_ID;
    if (!scorerUserId) { console.log(`  ! ${e.name}: no scorer login found; cannot assign`); continue; }
    console.log(`  + assign ${e.name} -> Mentor, scored by ${viaManager ? scorer!.scorerName : "Neha (fallback - People's own manager has no Review login)"}`);
    if (APPLY) await db.perfAssignment.create({ data: { employeeId: e.id, templateId: template!.id, scorerUserId } });
  }

  if (!APPLY) {
    console.log("\n--- Plans found (dry run) ---");
    const byPerson = new Map<string, MonthPlan[]>();
    for (const p of plans) { if (!byPerson.has(p.personFirst)) byPerson.set(p.personFirst, []); byPerson.get(p.personFirst)!.push(p); }
    for (const [first, rows] of byPerson) {
      rows.sort((a, b) => +a.period - +b.period);
      console.log(`  ${first.padEnd(12)} ${rows.map((r) => `${r.period.toISOString().slice(0, 7)}=${Math.round((r.weekTotals.reduce((s, v) => s + v, 0) / r.weekTotals.length) * 100) / 100}(${r.weeks.length}wk)`).join("  ")}`);
    }
    return console.log("\nNothing was written. Re-run with --apply.");
  }

  const employees2 = await db.employee.findMany({ where: { email: { in: [...new Set(Object.values(ALIAS))] } }, select: { id: true, name: true, email: true, perfAssignment: { select: { templateId: true, scorerUserId: true } } } });
  const reviews = await db.perfReview.findMany({ select: { employeeId: true, period: true } });
  const done = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));
  const freshTemplate = await db.perfTemplate.findFirst({ where: { name: "Mentor" }, include: { versions: { include: { kras: { include: { kpis: true } } } } } });

  for (const p of plans) {
    const email = ALIAS[p.personFirst === "abhishna" ? "abishna" : p.personFirst];
    const e = employees2.find((x) => x.email.toLowerCase() === email?.toLowerCase());
    if (!e || !e.perfAssignment) { console.log(`  ! ${p.personFirst}: no assignment; skipped ${p.period.toISOString().slice(0, 7)}`); continue; }
    const ym = p.period.toISOString().slice(0, 7);
    if (done.has(`${e.id}|${ym}`)) continue;
    const version = freshTemplate!.versions.filter((v) => +v.effectiveFrom <= +p.period).sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
    if (!version) { console.log(`  ! ${e.name} ${ym}: no version in force; skipped`); continue; }
    const kpiId = new Map(version.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
    const maxScore = version.kras.reduce((s, k) => s + k.kpis.reduce((s2, x) => s2 + x.maxPoints, 0), 0);
    const total = Math.round((p.weekTotals.reduce((s, v) => s + v, 0) / p.weekTotals.length) * 100) / 100;
    const scorer = e.perfAssignment.scorerUserId;
    const now = new Date();
    const scoreRows: Prisma.PerfScoreCreateManyInput[] = p.weeks.flatMap((weekKpis, i) =>
      [...weekKpis.entries()].flatMap(([key, value]) => {
        const id = kpiId.get(key);
        return id ? [{ employeeId: e.id, kpiId: id, period: p.period, week: i + 1, value, remark: "Imported from Tech School Mentor sheet", enteredById: scorer, enteredByName: "Imported from Tech School sheet" }] : [];
      }),
    );
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: scoreRows, skipDuplicates: true });
      await tx.perfReview.create({ data: { employeeId: e.id, period: p.period, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from Tech School sheet", submittedAt: now, decidedById: scorer, decidedByName: "Imported from Tech School sheet", decidedAt: now, finalScore: total, maxScore, weeksScored: p.weeks.length } });
      await writeAuditEvent(tx, { entityType: "PerfReview", entityId: e.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { finalScore: total, scores: scoreRows.length }, metadata: { source: "tech-mentor-import", period: ym } });
    });
    console.log(`  recorded ${ym} ${e.name} = ${total} (${scoreRows.length} KPI scores across ${p.weeks.length} weeks)`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
