/**
 * Loads the Haris & Co. Performance Marketing scorecards from HR's sheet
 * ("PM Team KRA - KPI Oct 2026.xlsx", one tab per person) and each role's
 * definition from its Role Clarity PDF, then assigns the people named.
 *
 * The sheet has two layouts: most tabs are KRA | KPI | Metric | Max | Week 1
 * Score | Week 1 Total ...; the design/video tabs are KRA | KPI | Definition |
 * Score | <person> weeks. Subtotal rows are skipped either way and totals are
 * recomputed. Critical / penalty rows are stored as unscored risks.
 *
 * Every scorecard must total exactly 100 or it is not loaded. Each person is
 * scored by their reporting manager in People. Nothing existing is
 * overwritten; no scores are imported.
 *
 *   npx tsx prisma/seed-pm.ts <sheet.xlsx> <folder of RCD PDFs>            # dry run
 *   npx tsx prisma/seed-pm.ts <sheet.xlsx> <folder of RCD PDFs> --apply
 *
 * Reading the PDFs needs `pdftotext` (poppler) on the PATH.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import ExcelJS from "exceljs";
import { matchByName } from "../src/domain/people/match";
import { PEOPLE_MANAGED } from "../src/lib/people-managed";
import { loadPeople, reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const [FILE, RCD_DIR] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ORG = "HARISCO";
const FROM = new Date(Date.UTC(2026, 9, 1)); // October 2026, the sheet's month
const db = reviewClient();

// ── Tab → scorecard, its Role Clarity PDF, and who holds it ────────────
const SHEETS: { tab: string; name: string; rcd: string | null; people: string[] }[] = [
  { tab: "Ashif (Exe. Media Buyer)", name: "PM – Junior Media Buyer", rcd: "Ashif - Role clarity 2.pdf", people: ["Ashif Nihal EP"] },
  { tab: "Alishba (Exe, Media Buyer)", name: "PM – Executive Media Buyer", rcd: "Alishba - Role clarity 1.pdf", people: ["Alishba Hamrain A P"] },
  { tab: "Ashly (CS )", name: "PM – Creative Strategist Lead", rcd: "Ashly - Role clarity.pdf", people: ["Ashly PK"] },
  { tab: "Nadha (Jr. Creative)", name: "PM – Junior Creative Strategist", rcd: "Nadha - Role clarity.pdf", people: ["Fathima Nadha"] },
  { tab: "Fardeen (CRO Expert)", name: "PM – CRO Expert", rcd: null, people: ["Fardeen"] },
  { tab: "Sinan (AI Automation)", name: "PM – AI Automation Specialist", rcd: "Sinan - Role clarity 1.pdf", people: ["Muhammed Sinan KK"] },
  { tab: "Arjun", name: "PM – Account Manager", rcd: "Arjun - Role clarity 1.pdf", people: ["Arjun K"] },
  { tab: "Aswin", name: "PM – Video Editor", rcd: "Aswin - Role clarity.pdf", people: ["Aswin KP"] },
  { tab: "Arunthathi Vimal", name: "PM – Graphic Designer", rcd: "Vimal - Role clarity 1.pdf", people: ["Arundhathi SK", "Vimal Raj P"] },
];

const text = (c: ExcelJS.Cell): string => {
  const v = c.value as unknown;
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return o.richText.map((t) => t.text).join("").trim();
    if (o.result != null) return String(o.result).trim();
    if (o.text) return o.text.trim();
    return "";
  }
  return String(v).replace(/\s+/g, " ").trim();
};
const num = (c: ExcelJS.Cell): number | null => {
  const v = c.value as unknown;
  const r = typeof v === "object" && v !== null && "result" in (v as object) ? (v as { result: unknown }).result : v;
  return typeof r === "number" && Number.isFinite(r) ? r : null;
};

interface Kpi { kra: string; kpi: string; max: number; measure: string }
interface Risk { group: string; item: string; measure: string; penalty: number | null }

function parseTab(ws: ExcelJS.Worksheet): { main: Kpi[]; risks: Risk[] } {
  const main: Kpi[] = [], risks: Risk[] = [];
  let critical = false;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const kra = text(row.getCell(1)), kpi = text(row.getCell(2)), measure = text(row.getCell(3)).slice(0, 480);
    const max = num(row.getCell(4));
    if (/critical kpis/i.test(kra)) { critical = true; return; }
    // Headers, subtotal rows ("Performance score", "Perfomance metric" repeated
    // across columns) and the TOTAL line.
    // Also the score summary block under the table ("Performance | 23.5").
    if (!kpi || /^[\d.]+$/.test(kpi) || kra === kpi || /^(kra|penalty kra)$/i.test(kra) || /^total/i.test(kra) || /score$/i.test(kra)) return;
    if (critical || max == null) {
      // Penalty rows (with points) after "Critical KPIs", or risk rows with no
      // max in the design/video layout.
      if (kra && kpi !== "KPI") risks.push({ group: kra, item: kpi, measure, penalty: critical ? max : null });
      return;
    }
    main.push({ kra, kpi, max, measure });
  });
  return { main, risks };
}

/** "01. Role Overview" paragraph → definition; "02. Core Responsibilities" bullets → responsibilities. */
function readRcd(file: string): { def: string; resp: string[] } | null {
  let raw: string;
  try {
    raw = execFileSync("pdftotext", [file, "-"], { encoding: "utf8" });
  } catch {
    return null;
  }
  const flat = raw.replace(/\r/g, "");
  const section = (start: RegExp, end: RegExp) => {
    const s = flat.search(start);
    if (s < 0) return "";
    const rest = flat.slice(s).replace(start, "");
    const e = rest.search(end);
    return (e < 0 ? rest : rest.slice(0, e)).trim();
  };
  const def = section(/0?1\.\s*Role Overview/i, /0?2\.\s/).replace(/\s+/g, " ").trim();
  const resp = section(/0?2\.\s*Core Responsibilities/i, /0?3\.\s/)
    .split(/[•●]/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 3);
  return def ? { def, resp } : null;
}

async function main() {
  if (!FILE || !RCD_DIR) throw new Error("Usage: seed-pm.ts <sheet.xlsx> <folder of RCD PDFs> [--apply]");
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const existing = new Set((await db.perfTemplate.findMany({ select: { name: true } })).map((t) => t.name));

  const parsed: { s: (typeof SHEETS)[number]; main: Kpi[]; risks: Risk[]; rcd: { def: string; resp: string[] } | null }[] = [];
  for (const s of SHEETS) {
    const ws = wb.getWorksheet(s.tab);
    if (!ws) { console.log(`  ! tab "${s.tab}" not found`); continue; }
    const { main, risks } = parseTab(ws);
    const total = main.reduce((a, k) => a + k.max, 0);
    const rcd = s.rcd ? readRcd(path.join(RCD_DIR, s.rcd)) : null;
    // HR's Junior Creative Strategist sheet covers 95 points (Reporting & Learning is 15); loaded as written.
    const ok = total === 100 || (s.name === "PM – Junior Creative Strategist" && total === 95);
    const kras = [...new Set(main.map((k) => k.kra))];
    console.log(
      `${s.name.padEnd(34)} ${String(main.length).padStart(2)} KPIs in ${kras.length} KRAs = ${total} pts | ${risks.length} risks | role definition: ${rcd ? "yes" : "none"}` +
        `${existing.has(s.name) ? "  [exists — skipped]" : ""}${ok ? "" : "  NOT 100 — NOT loaded"}`
    );
    if (process.env.SHOW_RISKS) for (const r of risks) console.log(`      risk: ${r.group} | ${r.item} | ${r.penalty}`);
    if (!ok) for (const k of kras) console.log(`      ${k}: ${main.filter((m) => m.kra === k).reduce((a, m) => a + m.max, 0)}`);
    if (ok) parsed.push({ s, main, risks, rcd });
  }

  // ── Assignments: scorer = Team Lead in People, else reporting manager ──
  const leadRows = await db.$queryRaw<{ email: string; scorerEmail: string | null; scorerName: string | null; via: string }[]>`
    SELECT lower(e."officialEmail") AS "email",
           lower(coalesce(tu."email", t."officialEmail", mu."email", m."officialEmail")) AS "scorerEmail",
           trim(coalesce(t."firstName" || ' ' || t."lastName", m."firstName" || ' ' || m."lastName")) AS "scorerName",
           CASE WHEN t."id" IS NOT NULL THEN 'team lead' ELSE 'reporting manager' END AS "via"
    FROM "public"."Employee" e
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId" LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId" LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"`;
  const leadOf = new Map(leadRows.map((r) => [r.email, r]));
  const loginsToCreate = new Map<string, string>();
  const people = (await loadPeople(db)).filter((p) => p.orgCode === ORG && p.active);
  const [employees, users, templates, assigned] = await Promise.all([
    db.employee.findMany({ where: { organization: { code: ORG }, isActive: true }, select: { id: true, name: true, email: true, reportingManagerName: true } }),
    db.user.findMany({ select: { id: true, email: true, name: true } }),
    db.perfTemplate.findMany({ select: { id: true, name: true } }),
    db.perfAssignment.findMany({ select: { employeeId: true } }),
  ]);
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const has = new Set(assigned.map((a) => a.employeeId));
  const templateId = new Map(templates.map((t) => [t.name, t.id]));

  console.log("\nAssignments (scorer = Team Lead, else reporting manager):");
  const plan: { employeeId: string; template: string; scorerEmail: string }[] = [];
  for (const { s } of parsed) {
    for (const who of s.people) {
      const e = matchByName(who, employees);
      if (e.kind !== "exact") { console.log(`  ! ${who}: not found as one Review employee (${e.kind})`); continue; }
      if (has.has(e.match.id)) { console.log(`  = ${e.match.name}: already assigned — left as is`); continue; }
      const lead = leadOf.get(e.match.email.toLowerCase());
      if (!lead?.scorerEmail) { console.log(`  ! ${e.match.name}: no team lead or manager in People — not assigned`); continue; }
      if (!userByEmail.has(lead.scorerEmail)) loginsToCreate.set(lead.scorerEmail, lead.scorerName ?? lead.scorerEmail);
      console.log(`  + ${e.match.name} → ${s.name}, scored by ${lead.scorerName} (${lead.via})`);
      plan.push({ employeeId: e.match.id, template: s.name, scorerEmail: lead.scorerEmail });
    }
  }

  for (const [email, name] of loginsToCreate) console.log(`  + Review login for ${name} <${email}> (signs in with People)`);
  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");
  for (const [email, name] of loginsToCreate) {
    const u = await db.user.create({ data: { email, name, role: "EMPLOYEE", passwordHash: PEOPLE_MANAGED, mustChangePassword: false }, select: { id: true, email: true, name: true } });
    userByEmail.set(email, u);
  }

  for (const { s, main, risks, rcd } of parsed) {
    if (existing.has(s.name)) continue;
    const kras = [...new Set(main.map((k) => k.kra))];
    const t = await db.perfTemplate.create({
      data: {
        name: s.name,
        roleDefinition: rcd?.def ?? null,
        responsibilities: rcd?.resp.join("\n") || null,
        versions: {
          create: {
            effectiveFrom: FROM,
            kras: {
              create: kras.map((name, ki) => ({
                name,
                sortOrder: ki,
                kpis: { create: main.filter((k) => k.kra === name).map((k, i) => ({ name: k.kpi, description: k.measure || null, maxPoints: k.max, sortOrder: i })) },
              })),
            },
            risks: {
              create: risks.map((r, i) => ({
                category: r.group,
                name: r.item,
                description: r.measure || null,
                alertLevel: "Critical KPI",
                deductible: true,
                maxPenalty: r.penalty,
                sortOrder: i,
              })),
            },
          },
        },
      },
    });
    templateId.set(s.name, t.id);
    console.log(`  created ${s.name}`);
  }
  for (const p of plan) {
    await db.perfAssignment.create({ data: { employeeId: p.employeeId, templateId: templateId.get(p.template)!, scorerUserId: userByEmail.get(p.scorerEmail)!.id } });
  }
  console.log(`\nDone. ${plan.length} assignments created.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
