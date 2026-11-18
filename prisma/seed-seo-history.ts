/**
 * Imports the Haris & Co. SEO team's monthly scores, April-October 2026, from
 * "KRA-KPI - SEO (Master).xlsx" (one tab per person, one block per month:
 * KRA | KPI | Obtained Score | Score Value, ending in TOTAL SCORE).
 *
 *  - Scores are monthly, so each month is stored as week 1 (the month result
 *    is the average of scored weeks) and recorded as a confirmed month.
 *  - A month whose KPI list differs from the scorecard version in force gets
 *    its own version from that month (e.g. the Team Lead before August).
 *  - People are matched in People by first name (leavers included; a leaver
 *    with no Review record gets an inactive one). Scorer = Team Lead in
 *    People, else reporting manager.
 *  - A person already on a different SEO scorecard with no scores yet is
 *    moved to the one their tab says (Riyas: Content Lead -> Senior writer).
 *  - The CRITICAL and WFH sections aren't scores; any marked incidents are
 *    listed, not deducted. Nothing existing is overwritten.
 *
 *   npx tsx prisma/seed-seo-history.ts <seo.xlsx>            # dry run
 *   npx tsx prisma/seed-seo-history.ts <seo.xlsx> --apply
 */
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { PEOPLE_MANAGED } from "../src/lib/people-managed";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"))!;
const db = reviewClient();

/** Tab -> [first name in People, scorecard]. Tabs not listed are skipped (and said so). */
const TABS: Record<string, [string, string]> = {
  TL: ["Aparna", "SEO Team Lead"],
  "Strategist- Muhsina": ["Muhsina", "SEO Strategist"],
  "Strategist- Abijith": ["Abijith", "SEO Strategist"],
  "Strategist- Shafna": ["Shafna", "SEO Strategist"],
  "Dev- Lead- Jithin": ["Jithin", "SEO Technical Developer – Lead"],
  "Analyst- Junior- Shahinsha": ["Shahinsha", "SEO Analyst – Junior"],
  "Analyst-  Amal": ["Amal", "SEO Analyst"],
  "Analyst-  Harith": ["Harith", "SEO Analyst"],
  "Analyst-  Basith": ["Basith", "SEO Analyst"],
  "Dev- Junior- Shakir": ["Shakir", "SEO Technical Developer – Junior"],
  "Content- Senior- Riyas": ["Riyas", "SEO Content Writer – Senior"],
  "Content- Junior- Nidhin": ["Nidhin", "SEO Content Writer – Junior"],
  "Content- Senior- Aravind": ["Aravind", "SEO Content Writer – Senior"],
};
const MONTHS: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, APRIL: 3, MAY: 4, JUN: 5, JUNE: 5, JUL: 6, JULY: 6, AUG: 7, SEP: 8, SEPT: 8, OCT: 9, NOV: 10, DEC: 11 };

type Kpi = { kra: string; name: string; max: number };
type Block = { tab: string; period: Date; kpis: Kpi[]; obtained: Map<string, number>; total: number | null; incidents: string[] };

const text = (c: ExcelJS.Cell) => {
  let x: unknown = c.value;
  if (x && typeof x === "object") x = (x as { result?: unknown }).result ?? (x as { text?: unknown }).text ?? (x as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("");
  return x == null ? "" : String(x).replace(/\s+/g, " ").trim();
};
const num = (s: string) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const idOf = (kra: string, name: string) => `${keyOf(kra)}|${keyOf(name)}`;
const sig = (k: Kpi[]) => k.map((x) => `${idOf(x.kra, x.name)}=${x.max}`).sort().join(";");

async function readBlocks(): Promise<Block[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const out: Block[] = [];
  wb.eachSheet((ws) => {
    if (!TABS[ws.name]) {
      if (!["Critical KPI", "Dashboard", "Monthly Quick"].includes(ws.name)) console.log(`  - tab "${ws.name}": not imported (see notes)`);
      return;
    }
    let cur: Block | null = null;
    let section: "main" | "critical" | "wfh" = "main";
    let kra = "";
    let lastKpi: string | null = null; // a score can land on the row below its KPI (merged cells)
    ws.eachRow((r) => {
      const a = text(r.getCell(1)), b = text(r.getCell(2)), c = text(r.getCell(3)), d = text(r.getCell(4));
      const m = /^([A-Z]+)\s*-?\s*(\d{2})$/.exec(a);
      if (m && MONTHS[m[1]] !== undefined && !b) {
        cur = { tab: ws.name, period: new Date(Date.UTC(2000 + Number(m[2]), MONTHS[m[1]], 1)), kpis: [], obtained: new Map(), total: null, incidents: [] };
        out.push(cur);
        section = "main";
        kra = "";
        return;
      }
      if (!cur) return;
      if (/^TOTAL SCORE/i.test(a)) return void ((cur as Block).total = num(c));
      if (/^CRITICAL/i.test(a)) return void (section = "critical");
      if (/^WFH/i.test(a)) return void (section = "wfh");
      if (a === "KRA") return;
      if (a) kra = a;
      if (!b) {
        // A lone number under a KPI that has none yet is that KPI's score.
        if (section === "main" && !a && lastKpi && num(c) != null && !(cur as Block).obtained.has(lastKpi)) (cur as Block).obtained.set(lastKpi, Number(c));
        return;
      }
      const max = num(d);
      if (section === "main") {
        if (max == null) return;
        (cur as Block).kpis.push({ kra, name: b, max });
        lastKpi = idOf(kra, b);
        const v = num(c);
        if (v != null) (cur as Block).obtained.set(lastKpi, v);
      } else if (section === "critical" && num(c) != null) {
        // A number against a critical KPI marks an incident; listed for HR, not deducted.
        (cur as Block).incidents.push(`critical: ${b} = ${c}`);
      }
    });
  });
  return out;
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const blocks = await readBlocks();

  // ── Scorecard versions needed ──
  const templates = await db.perfTemplate.findMany({
    where: { name: { in: [...new Set(Object.values(TABS).map((t) => t[1]))] } },
    select: { id: true, name: true, versions: { select: { effectiveFrom: true, kras: { select: { name: true, kpis: { select: { name: true, maxPoints: true } } } } } } },
  });
  const tByName = new Map(templates.map((t) => [t.name, t]));
  type V = { from: Date; kpis: Kpi[]; isNew: boolean };
  const versions = new Map<string, V[]>();
  for (const t of templates) {
    versions.set(t.name, t.versions.map((v) => ({ from: v.effectiveFrom, kpis: v.kras.flatMap((k) => k.kpis.map((p) => ({ kra: k.name, name: p.name, max: p.maxPoints }))), isNew: false })).sort((a, b) => +a.from - +b.from));
  }
  const inForce = (name: string, at: Date) => (versions.get(name) ?? []).filter((v) => +v.from <= +at).at(-1);
  console.log("SCORECARD VERSIONS");
  for (const blk of [...blocks].sort((a, b) => +a.period - +b.period)) {
    const tmpl = TABS[blk.tab][1];
    if (blk.obtained.size === 0) continue;
    if (!tByName.has(tmpl)) { console.log(`  ! ${tmpl}: scorecard not found`); continue; }
    const v = inForce(tmpl, blk.period);
    if (v && sig(v.kpis) === sig(blk.kpis)) continue;
    const list = versions.get(tmpl)!;
    if (list.some((x) => +x.from === +blk.period)) continue; // another person's tab already added this month's version
    const total = blk.kpis.reduce((s, k) => s + k.max, 0);
    list.push({ from: blk.period, kpis: blk.kpis, isNew: true });
    list.sort((a, b) => +a.from - +b.from);
    console.log(`  + ${tmpl} from ${blk.period.toISOString().slice(0, 7)} (${blk.kpis.length} KPIs = ${total}) [${blk.tab}]${v ? "" : " (before the first version)"}`);
  }

  // ── People ──
  const ppl = await db.$queryRaw<{ id: string; first: string; name: string; email: string; status: string; designation: string | null; scorerEmail: string | null; scorerName: string | null; via: string }[]>`
    SELECT e."id", e."firstName" AS "first", trim(regexp_replace(e."firstName" || ' ' || e."lastName", '\\s+', ' ', 'g')) AS "name", lower(e."officialEmail") AS "email",
           e."employmentStatus"::text AS "status", des."title" AS "designation",
           lower(coalesce(tu."email", t."officialEmail", mu."email", m."officialEmail")) AS "scorerEmail",
           trim(coalesce(t."firstName" || ' ' || t."lastName", m."firstName" || ' ' || m."lastName")) AS "scorerName",
           CASE WHEN t."id" IS NOT NULL THEN 'team lead' ELSE 'reporting manager' END AS "via"
    FROM "public"."Employee" e
    JOIN "public"."Organization" o ON o."id" = e."organizationId" AND o."code" = 'HARISCO'
    LEFT JOIN "public"."Designation" des ON des."id" = e."designationId"
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId" LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId" LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"
    WHERE e."archivedAt" IS NULL`;
  const [employees, users, assignments, reviews, seoDept] = await Promise.all([
    db.employee.findMany({ select: { id: true, name: true, peopleEmployeeId: true, isActive: true, _count: { select: { perfScores: true } } } }),
    db.user.findMany({ select: { id: true, email: true } }),
    db.perfAssignment.findMany({ select: { id: true, employeeId: true, template: { select: { name: true } } } }),
    db.perfReview.findMany({ select: { employeeId: true, period: true } }),
    db.department.findFirst({ where: { name: "SEO", organization: { code: "HARISCO" } }, select: { id: true, organizationId: true } }),
  ]);
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const assignmentOf = new Map(assignments.map((a) => [a.employeeId, a]));
  const reviewed = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));

  console.log("\nPEOPLE");
  type Plan = { tab: string; template: string; person: (typeof ppl)[number]; employeeId: string | null; action: "assign" | "move" | "keep"; assignmentId?: string };
  const plans = new Map<string, Plan>();
  const logins = new Map<string, string>();
  for (const [tab, [first, template]] of Object.entries(TABS)) {
    const hits = ppl.filter((p) => p.first.trim().toLowerCase().startsWith(first.toLowerCase()));
    // Prefer someone whose designation says SEO, when the first name is shared (e.g. Ajmal).
    const seo = hits.filter((p) => /seo|content|analyst|strateg|develop/i.test(p.designation ?? ""));
    const p = hits.length === 1 ? hits[0] : seo.length === 1 ? seo[0] : null;
    if (!p) { console.log(`  ! ${tab}: ${hits.length ? `several "${first}"s (${hits.map((h) => h.name).join(", ")})` : `no "${first}" in People`}; skipped`); continue; }
    const e = employees.find((x) => x.peopleEmployeeId === p.id);
    const a = e ? assignmentOf.get(e.id) : undefined;
    let action: Plan["action"] = "assign";
    if (a && a.template.name === template) action = "keep";
    else if (a && a.template.name.startsWith("SEO") && e!._count.perfScores === 0) action = "move";
    else if (a) { console.log(`  ! ${p.name}: already on "${a.template.name}" with scores; tab "${tab}" skipped`); continue; }
    if (!p.scorerEmail) { console.log(`  ! ${p.name}: no team lead or manager in People; skipped`); continue; }
    if (!userByEmail.has(p.scorerEmail)) logins.set(p.scorerEmail, p.scorerName ?? p.scorerEmail);
    plans.set(tab, { tab, template, person: p, employeeId: e?.id ?? null, action, assignmentId: a?.id });
    const note = action === "move" ? `moved from "${a!.template.name}"` : action === "keep" ? "already on it" : "assign";
    console.log(`  ${p.name.padEnd(22)} ${p.status.toLowerCase().padEnd(9)} → ${template.padEnd(34)} ${note}; scored by ${p.scorerName} (${p.via})${e ? "" : "  + new inactive Review record"}`);
  }
  for (const [email, name] of logins) console.log(`  + Review login for ${name} <${email}>`);

  console.log("\nMONTHS");
  const months: { blk: Block; plan: Plan; result: number; max: number }[] = [];
  for (const blk of blocks) {
    const plan = plans.get(blk.tab);
    if (!plan) continue;
    const ym = blk.period.toISOString().slice(0, 7);
    const max = blk.kpis.reduce((s, k) => s + k.max, 0);
    const result = Math.round([...blk.obtained.values()].reduce((s, v) => s + v, 0) * 100) / 100;
    const over = blk.kpis.filter((k) => (blk.obtained.get(idOf(k.kra, k.name)) ?? 0) > k.max).map((k) => k.name);
    const skip = plan.employeeId && reviewed.has(`${plan.employeeId}|${ym}`);
    const diff = blk.total != null && Math.abs(blk.total - result) > 0.05 ? `  ≠ sheet ${blk.total}` : "";
    if (blk.obtained.size === 0) { console.log(`  ${ym} ${plan.person.name.padEnd(22)} no scores in the block; skipped`); continue; }
    console.log(`  ${ym} ${plan.person.name.padEnd(22)} ${result} / ${max}${diff}${skip ? "  [already recorded, skipped]" : ""}`);
    for (const k of over) console.log(`        ! "${k}" is above its max; skipped`);
    for (const i of blk.incidents) console.log(`        · ${i} (listed, not deducted)`);
    if (!skip) months.push({ blk, plan, result, max });
  }

  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  for (const [email, name] of logins) userByEmail.set(email, (await db.user.create({ data: { email, name, role: "EMPLOYEE", passwordHash: PEOPLE_MANAGED, mustChangePassword: false }, select: { id: true } })).id);
  for (const [name, list] of versions) {
    for (const v of list.filter((x) => x.isNew)) {
      const kras = [...new Set(v.kpis.map((k) => k.kra))];
      await db.perfTemplateVersion.create({
        data: { templateId: tByName.get(name)!.id, effectiveFrom: v.from, kras: { create: kras.map((kra, i) => ({ name: kra, sortOrder: i, kpis: { create: v.kpis.filter((k) => k.kra === kra).map((k, j) => ({ name: k.name, maxPoints: k.max, sortOrder: j })) } })) } },
      });
      console.log(`  version ${name} from ${v.from.toISOString().slice(0, 7)}`);
    }
  }
  for (const plan of plans.values()) {
    if (!plan.employeeId) {
      plan.employeeId = (await db.employee.create({
        data: { name: plan.person.name, email: plan.person.email, peopleEmployeeId: plan.person.id, designation: plan.person.designation, organizationId: seoDept!.organizationId, departmentId: seoDept!.id, isActive: ["ACTIVE", "ON_NOTICE"].includes(plan.person.status) },
        select: { id: true },
      })).id;
    }
    const scorer = userByEmail.get(plan.person.scorerEmail!)!;
    const templateId = tByName.get(plan.template)!.id;
    if (plan.action === "assign") await db.perfAssignment.create({ data: { employeeId: plan.employeeId, templateId, scorerUserId: scorer } });
    if (plan.action === "move") await db.perfAssignment.update({ where: { id: plan.assignmentId! }, data: { templateId, scorerUserId: scorer } });
  }
  for (const m of months) {
    const scorer = userByEmail.get(m.plan.person.scorerEmail!)!;
    const version = await db.perfTemplateVersion.findFirst({
      where: { templateId: tByName.get(m.plan.template)!.id, effectiveFrom: { lte: m.blk.period } },
      orderBy: { effectiveFrom: "desc" },
      include: { kras: { include: { kpis: true } } },
    });
    const kpis = new Map(version!.kras.flatMap((kra) => kra.kpis.map((k) => [idOf(kra.name, k.name), k] as const)));
    const rows: Prisma.PerfScoreCreateManyInput[] = [];
    for (const [k, v] of m.blk.obtained) {
      const kpi = kpis.get(k);
      if (kpi && v >= 0 && v <= kpi.maxPoints) rows.push({ employeeId: m.plan.employeeId!, kpiId: kpi.id, period: m.blk.period, week: 1, value: v, remark: "Monthly score from SEO sheet", enteredById: scorer, enteredByName: "Imported from SEO sheet" });
    }
    const sum = Math.round(rows.reduce((s, r) => s + r.value, 0) * 100) / 100;
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: rows, skipDuplicates: true });
      const now = new Date();
      await tx.perfReview.create({
        data: { employeeId: m.plan.employeeId!, period: m.blk.period, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from SEO sheet", submittedAt: now, decidedById: scorer, decidedByName: "Imported from SEO sheet", decidedAt: now, finalScore: sum, maxScore: m.max, weeksScored: 1 },
      });
      await writeAuditEvent(tx, { entityType: "PerfScore", entityId: m.plan.employeeId!, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { scores: rows.length }, metadata: { source: "seo-history-import", tab: m.blk.tab, period: m.blk.period.toISOString().slice(0, 7) } });
    });
  }
  console.log(`\nDone. ${months.length} months recorded.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
