/**
 * Design School mentors' June-October 2026 history from
 * "Mentors KPA - KRI - Design School.xlsx". Nothing was loaded for this
 * department before this.
 *
 * The existing "Mentor" PerfTemplate in Review (16 KPIs, max 100) does not
 * match this sheet at all (14 KPIs, "Total out of 60") - it was set up for
 * something else and never used (no PerfReview exists on it). This creates
 * a new "Design School Mentor" template instead, with one version (the
 * KRA/KPI/weight structure is identical June-October; only the column
 * layout changes - August+ adds a "Remarks" column after each week, which
 * is ignored here).
 *
 * Layout: KRA | KPI | Metric | Score (shared max-points column) then one
 * 4-or-8-column block per person (June-August: 4 cols, one score per week;
 * September-October: 8 cols, score+Remarks pairs). People: Fathima,
 * Zulal, Nijin (June-Aug) / Neeha (Sep-Oct, a seat change - same scorecard,
 * different mentor), Ishaam, and Sahal (new in October). "Total out of 60"
 * is the authoritative month total; a week with every KPI at 0 (Neeha's
 * October weeks 1-2) is loaded as a real 0, not skipped - the sheet marks
 * it that way deliberately, not as a blank.
 *
 *   npx tsx prisma/seed-design-mentors.ts            # dry run
 *   npx tsx prisma/seed-design-mentors.ts --apply
 */
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();
const FILE = "C:/Users/ASUS/Downloads/Mentors KPA - KRI - Design School.xlsx";
const m = (mm: number) => new Date(Date.UTC(2026, mm, 1));
const MONTHS: [string, Date][] = [["June", m(5)], ["July", m(6)], ["August", m(7)], ["September", m(8)], ["October", m(9)]];

// Sheet first name -> People official email.
const ALIAS: Record<string, string> = {
  fathima: "sahada@harisandcoacademy.com",
  zulal: "zulal@harisandcoacademy.com",
  nijin: "nijin@harisandcoacademy.com",
  neeha: "neeha@harisandcoacademy.com",
  ishaam: "mr.ishamzubair@gmail.com",
  sahal: "sahal@harisandcoacademy.com",
};

type Cell = ExcelJS.Cell;
const text = (c: Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

interface Block { name: string; weekCols: number[] }
interface MonthPlan { period: Date; personFirst: string; weeks: Map<string, number>[]; weekTotals: number[] }

function findBlocks(ws: ExcelJS.Worksheet): Block[] {
  const nameRow = ws.getRow(1), labelRow = ws.getRow(2);
  const blocks: Block[] = [];
  let c = 5; // col4 is the shared "Score" (max points) column
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
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  // KPI rows are stable across months; read them once from June.
  const ws0 = wb.getWorksheet("June")!;
  const kpis: { kra: string; name: string; max: number; row: number }[] = [];
  let totalRow = -1;
  for (let r = 3; r <= ws0.rowCount; r++) {
    const row = ws0.getRow(r);
    const kra = text(row.getCell(1)), kpi = text(row.getCell(2)), score = num(text(row.getCell(4)));
    if (/^total/i.test(kra)) { totalRow = r; break; }
    if (kra && kpi && score != null) kpis.push({ kra, name: kpi, max: score, row: r });
  }
  console.log(`KPIs (from June): ${kpis.length}, max = ${kpis.reduce((s, k) => s + k.max, 0)}`);

  const plans: MonthPlan[] = [];
  for (const [sheetName, period] of MONTHS) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(`  ! ${sheetName}: not found`); continue; }
    // Find this month's own Total row (row numbers can drift if a sheet has extra rows).
    let tRow = totalRow;
    for (let r = 3; r <= ws.rowCount; r++) if (/^total/i.test(text(ws.getRow(r).getCell(1)))) { tRow = r; break; }
    for (const b of findBlocks(ws)) {
      const first = keyOf(b.name).split(" ")[0];
      const weeks: Map<string, number>[] = [];
      const weekTotals: number[] = [];
      for (const col of b.weekCols) {
        const total = num(text(ws.getRow(tRow).getCell(col)));
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
      plans.push({ period, personFirst: first, weeks, weekTotals });
    }
  }

  // Resolve people, matching by first-or-last name word against People.
  const people = await db.$queryRaw<{ firstName: string; lastName: string; email: string; status: string }[]>`
    SELECT lower(e."firstName") AS "firstName", lower(e."lastName") AS "lastName", lower(coalesce(u."email", e."officialEmail")) AS "email", e."employmentStatus"::text AS "status"
    FROM "public"."Employee" e LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    WHERE e."archivedAt" IS NULL`;
  const byWord = new Map<string, { email: string; status: string }>();
  for (const p of people) {
    for (const word of [...p.firstName.split(" "), ...p.lastName.split(" ")]) {
      if (!word) continue;
      const existing = byWord.get(word);
      const active = p.status === "ACTIVE" || p.status === "ON_NOTICE";
      if (!existing || (active && existing.status !== "ACTIVE" && existing.status !== "ON_NOTICE")) byWord.set(word, { email: p.email, status: p.status });
      else if (active && (existing.status === "ACTIVE" || existing.status === "ON_NOTICE") && existing.email !== p.email) byWord.set(word, { email: "__AMBIGUOUS__", status: p.status });
    }
  }

  const employees = await db.employee.findMany({
    where: { departmentId: "cmti7ta7l0007uiu0j7zeqmjb" },
    select: { id: true, name: true, email: true, perfAssignment: { select: { id: true, templateId: true, scorerUserId: true } } },
  });

  // Template: create "Design School Mentor" if missing, using the sheet's own KRA/KPI/weight structure.
  let template = await db.perfTemplate.findFirst({ where: { name: "Design School Mentor" }, include: { versions: { include: { kras: { include: { kpis: true } } } } } });
  if (!template) {
    console.log(`\n+ create template "Design School Mentor" (${kpis.length} KPIs, max ${kpis.reduce((s, k) => s + k.max, 0)}, version from 2026-06)`);
    if (APPLY) {
      const kras = [...new Set(kpis.map((k) => k.kra))];
      template = await db.perfTemplate.create({
        data: {
          name: "Design School Mentor",
          versions: { create: [{ effectiveFrom: m(5), kras: { create: kras.map((kra, i) => ({ name: kra, sortOrder: i, kpis: { create: kpis.filter((k) => k.kra === kra).map((k, j) => ({ name: k.name, maxPoints: k.max, sortOrder: j })) } })) } }] },
        },
        include: { versions: { include: { kras: { include: { kpis: true } } } } },
      });
    }
  } else {
    console.log(`\n= template "Design School Mentor" already exists`);
  }

  // Assignments: give each resolved mentor the template if they don't have it yet. Scorer: Academic Lead (Neha/Rashid) via dottedLine/reportingManager, same pattern as other loaders.
  const scorerLookup = await db.$queryRaw<{ email: string; scorerEmail: string | null; scorerName: string | null }[]>`
    SELECT lower(coalesce(u."email", e."officialEmail")) AS email, lower(coalesce(tu."email", t."officialEmail", mu."email", m."officialEmail")) AS "scorerEmail",
           trim(coalesce(t."firstName" || ' ' || t."lastName", m."firstName" || ' ' || m."lastName")) AS "scorerName"
    FROM "public"."Employee" e LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId" LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId" LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"
    WHERE lower(coalesce(u."email", e."officialEmail")) = ANY(${Object.values(ALIAS)})`;
  const scorerByEmail = new Map(scorerLookup.map((s) => [s.email, s]));
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  for (const [first, email] of Object.entries(ALIAS)) {
    const e = employees.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!e) { console.log(`  ! ${first} <${email}>: no Review employee in Design School`); continue; }
    if (e.perfAssignment) continue;
    const scorer = scorerByEmail.get(email);
    const scorerUserId = scorer?.scorerEmail ? userByEmail.get(scorer.scorerEmail) : undefined;
    if (!scorerUserId) { console.log(`  ! ${e.name}: no scorer login found; cannot assign`); continue; }
    console.log(`  + assign ${e.name} -> Design School Mentor, scored by ${scorer!.scorerName}`);
    if (APPLY && template) await db.perfAssignment.create({ data: { employeeId: e.id, templateId: template.id, scorerUserId } });
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

  // Re-fetch employees/assignments now that new ones may have just been created.
  const employees2 = await db.employee.findMany({ where: { departmentId: "cmti7ta7l0007uiu0j7zeqmjb" }, select: { id: true, name: true, email: true, perfAssignment: { select: { templateId: true, scorerUserId: true } } } });
  const reviews = await db.perfReview.findMany({ select: { employeeId: true, period: true } });
  const done = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));
  const freshTemplate = await db.perfTemplate.findFirst({ where: { name: "Design School Mentor" }, include: { versions: { include: { kras: { include: { kpis: true } } } } } });
  const version = freshTemplate!.versions[0];
  const kpiId = new Map(version.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
  const maxScore = version.kras.reduce((s, k) => s + k.kpis.reduce((s2, x) => s2 + x.maxPoints, 0), 0);

  for (const p of plans) {
    const email = ALIAS[p.personFirst];
    const e = employees2.find((x) => x.email.toLowerCase() === email?.toLowerCase());
    if (!e || !e.perfAssignment) { console.log(`  ! ${p.personFirst}: no assignment; skipped ${p.period.toISOString().slice(0, 7)}`); continue; }
    const ym = p.period.toISOString().slice(0, 7);
    if (done.has(`${e.id}|${ym}`)) continue;
    const total = Math.round((p.weekTotals.reduce((s, v) => s + v, 0) / p.weekTotals.length) * 100) / 100;
    const scorer = e.perfAssignment.scorerUserId;
    const now = new Date();
    const scoreRows: Prisma.PerfScoreCreateManyInput[] = p.weeks.flatMap((weekKpis, i) =>
      [...weekKpis.entries()].flatMap(([key, value]) => {
        const id = kpiId.get(key);
        return id ? [{ employeeId: e.id, kpiId: id, period: p.period, week: i + 1, value, remark: "Imported from Design School Mentor sheet", enteredById: scorer, enteredByName: "Imported from Design School sheet" }] : [];
      }),
    );
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: scoreRows, skipDuplicates: true });
      await tx.perfReview.create({ data: { employeeId: e.id, period: p.period, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from Design School sheet", submittedAt: now, decidedById: scorer, decidedByName: "Imported from Design School sheet", decidedAt: now, finalScore: total, maxScore, weeksScored: p.weeks.length } });
      await writeAuditEvent(tx, { entityType: "PerfReview", entityId: e.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { finalScore: total, scores: scoreRows.length }, metadata: { source: "design-mentor-import", period: ym } });
    });
    console.log(`  recorded ${ym} ${e.name} = ${total} (${scoreRows.length} KPI scores across ${p.weeks.length} weeks)`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
