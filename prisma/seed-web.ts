/**
 * Loads the Haris & Co. Web department's scorecards from HR's KRA/KPI CSVs
 * (one file per role), with each role's definition from its Role Clarity
 * Document, and assigns the people HR named to them.
 *
 * Scored KPIs (is_critical_kra = 0) must total exactly 100 or the scorecard is
 * not loaded. Critical rows are stored as unscored risks, as in the SEO load.
 * Scoring follows the reporting manager: each person's scorer is their
 * reporting manager in People, who must already have a Review login. The
 * reviewer is whoever scores that scorer, as everywhere else.
 *
 * Nothing existing is overwritten, and no scores are imported.
 *
 *   npx tsx prisma/seed-web.ts "<folder with the CSVs>"            # dry run
 *   npx tsx prisma/seed-web.ts "<folder with the CSVs>" --apply
 */
import fs from "node:fs";
import path from "node:path";
import { matchByName } from "../src/domain/people/match";
import { loadPeople, reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const DIR = process.argv.slice(2).find((a) => !a.startsWith("--"));
const ORG = "HARISCO";
const FROM = new Date(Date.UTC(2026, 9, 1)); // October 2026
const db = reviewClient();

function parseCsv(t: string): string[][] {
  const rows: string[][] = [];
  let r: string[] = [], f = "", q = false;
  t = t.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { r.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; r.push(f); f = ""; if (r.length > 1 || r[0]) rows.push(r); r = []; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}

/** Fixes the sheet's typos: HTML-escaped "<", and a one-letter placeholder row. */
const clean = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const KPI_FIXES: Record<string, string> = { k: "Missing / incomplete update" };

// ── Role definitions, from each Role Clarity Document ──────────────────
const RCD: Record<string, { def: string; resp: string[] }> = {
  juniorWeb: {
    def: "Develops and implements websites on WordPress and Shopify, converting Figma designs into fully functional, responsive sites while keeping design accuracy and usability. Also guides and supports interns from the Haris&Co internship batches.",
    resp: [
      "Website development on WordPress and Shopify",
      "Figma-to-website implementation that matches the design team's layout, spacing and visual consistency",
      "Responsive behaviour across desktop, tablet and mobile",
      "Page builders: Elementor primarily, Divi for occasional updates",
      "Theme, plugin and site-structure setup and configuration",
      "Guiding interns and assisting a paid WordPress intern",
    ],
  },
  juniorUiux: {
    def: "Designs intuitive, visually engaging interfaces across multiple client projects: wireframes, UI layouts and visual components that improve usability, kept consistent with brand guidelines. Also guides and manages UI/UX interns.",
    resp: [
      "Design UI layouts and website sections for multiple client projects",
      "Create wireframes and page structures for new pages and features",
      "Develop UI components and visual design elements",
      "Keep visual consistency and usability across projects",
      "Implement design updates from project feedback",
      "Collaborate with designers, developers and project teams; support UI/UX interns",
    ],
  },
  qa: {
    def: "Ensures the quality, functionality, usability and stability of web applications through systematic testing: identifies defects, validates behaviour against requirements and gives QA/QC sign-off before release.",
    resp: [
      "Manual testing of web applications and websites",
      "Identify, document and track bugs and usability issues (title, steps, expected and actual result, evidence, severity)",
      "Verify UI/UX consistency across pages and devices",
      "Validate functional requirements and workflows",
      "Regression testing after fixes and updates",
      "QA/QC sign-off after final validation",
    ],
  },
  writer: {
    def: "Writes and develops website content from the client's requirements, brand voice and identity, presenting information clearly and in the client's tone.",
    resp: [
      "Write content for homepages, about, service and landing pages and blogs",
      "Adapt style to the client's brand voice and tone",
      "Structure page content with clear headings, sections and short paragraphs",
      "Edit and revise drafts from client and team feedback",
      "Work with designers and developers so content fits the layout",
      "Measured on: client approval rate 95%+, 100% on-time delivery, under 2 revision rounds per page, 7-10 pages of content",
    ],
  },
  shopify: {
    def: "Builds, customises and maintains eCommerce stores on Shopify, combining technical and strategic skill to deliver high-performance, user-friendly online stores.",
    resp: [
      "Build and maintain Shopify stores from concept to launch; customise themes with HTML, CSS, JavaScript and Liquid",
      "Manage product catalogues and collections; test, debug and optimise",
      "Research Shopify updates, apps and integrations",
      "Client meetings: gather requirements, present mockups and progress, translate business goals into technical plans",
      "Client training on the Shopify admin, with documentation and post-launch support",
    ],
  },
};

// ── CSV file → scorecard name, and who holds it ────────────────────────
const SHEETS: { file: string; name: string; rcd?: string; people: string[] }[] = [
  { file: "Junior Web Developer.csv", name: "Web – Junior Web Developer", rcd: "juniorWeb", people: ["Dikra", "Visakh"] },
  { file: "Junior UIUX Designer.csv", name: "Web – Junior UI/UX Designer", rcd: "juniorUiux", people: ["Shabeer"] },
  { file: "Junior QAQC Tester.csv", name: "Web – Junior QA/QC Tester", rcd: "qa", people: ["Riya Ummer"] },
  { file: "Senior UIUX Designer.csv", name: "Web – Senior UI/UX Designer", people: ["Shijumon G"] },
  { file: "Web Content Writer.csv", name: "Web – Content Writer", rcd: "writer", people: ["Manal"] },
  { file: "Project Manager.csv", name: "Web – Project Manager", people: ["Sangeeth"] },
  { file: "Senior Shopify Developer.csv", name: "Web – Senior Shopify Developer", rcd: "shopify", people: [] },
  { file: "Junior Full Stack Developer.csv", name: "Web – Junior Full Stack Developer", people: ["Muhammed Shifin"] },
  { file: "Web Developer Intern.csv", name: "Web – Developer Intern", people: [] },
];

interface Kpi { kra: string; kpi: string; max: number }
interface Risk { group: string; item: string }

async function main() {
  if (!DIR) throw new Error("Pass the folder that holds the KRA CSVs.");
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");

  const existing = new Set((await db.perfTemplate.findMany({ select: { name: true } })).map((t) => t.name));
  const parsed: { s: (typeof SHEETS)[number]; main: Kpi[]; risks: Risk[] }[] = [];
  for (const s of SHEETS) {
    const rows = parseCsv(fs.readFileSync(path.join(DIR, s.file), "utf8")).slice(1);
    const main: Kpi[] = [], risks: Risk[] = [];
    for (const [, , kra, crit, kpiRaw, max] of rows) {
      const kpi = KPI_FIXES[clean(kpiRaw)] ?? clean(kpiRaw);
      if (crit === "1") risks.push({ group: clean(kra), item: kpi });
      else main.push({ kra: clean(kra), kpi, max: Number(max) });
    }
    const total = main.reduce((a, k) => a + k.max, 0);
    const kras = new Set(main.map((k) => k.kra)).size;
    const ok = total === 100;
    console.log(`${s.name.padEnd(38)} ${String(main.length).padStart(2)} KPIs in ${kras} KRAs = ${total} pts | ${risks.length} risks | role definition: ${s.rcd ? "yes" : "none"}${existing.has(s.name) ? "  [exists — skipped]" : ""}${ok ? "" : "  NOT 100 — NOT loaded"}`);
    if (ok) parsed.push({ s, main, risks });
  }

  // ── Assignments: scorer = reporting manager ─────────────────────────
  const people = (await loadPeople(db)).filter((p) => p.orgCode === ORG && p.active);
  const [employees, users, templates, assigned] = await Promise.all([
    db.employee.findMany({ where: { organization: { code: ORG } }, select: { id: true, name: true, email: true, reportingManagerName: true } }),
    db.user.findMany({ select: { id: true, email: true, name: true } }),
    db.perfTemplate.findMany({ select: { id: true, name: true } }),
    db.perfAssignment.findMany({ select: { employeeId: true } }),
  ]);
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const has = new Set(assigned.map((a) => a.employeeId));
  const templateId = new Map(templates.map((t) => [t.name, t.id]));

  console.log("\nAssignments (scorer = reporting manager):");
  const plan: { employeeId: string; template: string; scorerUserId: string }[] = [];
  for (const { s } of parsed) {
    for (const who of s.people) {
      const e = matchByName(who, employees);
      if (e.kind !== "exact") { console.log(`  ! ${who}: not found as one Review employee (${e.kind})`); continue; }
      if (has.has(e.match.id)) { console.log(`  = ${e.match.name}: already assigned — left as is`); continue; }
      // People is the source of truth for who reports to whom; Review's copy can be stale.
      const inPeople = people.find((p) => p.officialEmail === e.match.email.toLowerCase());
      const mgrName = inPeople?.manager ?? e.match.reportingManagerName;
      const mgr = mgrName ? matchByName(mgrName, people) : null;
      const login = mgr && mgr.kind === "exact" ? mgr.match.loginEmail : null;
      const scorer = login ? userByEmail.get(login.toLowerCase()) : null;
      if (!scorer) { console.log(`  ! ${e.match.name}: manager "${mgrName}" has no Review login yet — not assigned`); continue; }
      console.log(`  + ${e.match.name} → ${s.name}, scored by ${scorer.name}`);
      plan.push({ employeeId: e.match.id, template: s.name, scorerUserId: scorer.id });
    }
  }

  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  for (const { s, main, risks } of parsed) {
    if (existing.has(s.name)) continue;
    const r = s.rcd ? RCD[s.rcd] : undefined;
    const kras = [...new Set(main.map((k) => k.kra))];
    const t = await db.perfTemplate.create({
      data: {
        name: s.name,
        roleDefinition: r?.def ?? null,
        responsibilities: r?.resp.join("\n") ?? null,
        versions: {
          create: {
            effectiveFrom: FROM,
            kras: { create: kras.map((name, ki) => ({ name, sortOrder: ki, kpis: { create: main.filter((k) => k.kra === name).map((k, i) => ({ name: k.kpi, maxPoints: k.max, sortOrder: i })) } })) },
            risks: { create: risks.map((x, i) => ({ category: x.group, name: x.item, alertLevel: /exception buffer/i.test(x.group) ? null : "Critical KPI", deductible: !/exception buffer/i.test(x.group), sortOrder: i })) },
          },
        },
      },
    });
    templateId.set(s.name, t.id);
    console.log(`  created ${s.name}`);
  }
  for (const p of plan) {
    await db.perfAssignment.create({ data: { employeeId: p.employeeId, templateId: templateId.get(p.template)!, scorerUserId: p.scorerUserId } });
  }
  console.log(`\nDone. ${plan.length} assignments created.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
