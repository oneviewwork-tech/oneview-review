/**
 * Loads the Haris & Co. SEO department's scorecards from HR's master sheet
 * ("KRA-KPI - SEO (Master).xlsx"), with each role's definition and
 * responsibilities from its Role Clarity Document.
 *
 * What it reads, per role tab: the scored KPIs (their KRA, weight and what is
 * measured), the Critical KPIs (shown as risks, never scored) and the WFH
 * discipline checks (also shown, kept outside the 100 points as the sheet
 * does). Every scorecard must total exactly 100 or it is not loaded.
 *
 * It creates scorecards only — no people are assigned and no scores are
 * imported. A scorecard that already exists is left alone.
 *
 *   npx tsx prisma/seed-seo.ts            # dry run
 *   npx tsx prisma/seed-seo.ts --apply
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const FILE = path.join(process.env.USERPROFILE ?? "C:/Users/ASUS", "Downloads", "KRA-KPI - SEO (Master).xlsx");
const db = reviewClient();

interface Row {
  kra: string;
  kpi: string;
  max: number | null;
  measure: string;
}
interface Block {
  month: number; // 1-12 of 2026
  main: Row[];
  critical: Row[];
  wfh: Row[];
}

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const text = (c: ExcelJS.Cell): string => {
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
const num = (c: ExcelJS.Cell): number | null => {
  const v = c.value as unknown;
  const r = typeof v === "object" && v !== null && "result" in (v as object) ? (v as { result: unknown }).result : v;
  return typeof r === "number" && Number.isFinite(r) ? r : null;
};

function parseTab(ws: ExcelJS.Worksheet): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  let section: "main" | "critical" | "wfh" = "main";
  ws.eachRow({ includeEmpty: false }, (row) => {
    const a = text(row.getCell(1));
    const b = text(row.getCell(2));
    const head = /^([A-Z]{3})[A-Z]*\s*-\s*\d{2}$/.exec(a);
    if (head && MONTHS[head[1]]) {
      cur = { month: MONTHS[head[1]], main: [], critical: [], wfh: [] };
      blocks.push(cur);
      section = "main";
      return;
    }
    if (!cur) return;
    if (/^TOTAL SCORE/i.test(a)) { section = "critical"; return; }
    if (/^CRITICAL/i.test(a)) { section = "critical"; return; }
    if (/^WFH/i.test(a)) { section = "wfh"; return; }
    if (a === "KRA" || !b) return;
    const list = cur[section];
    list.push({ kra: a || (list.at(-1)?.kra ?? ""), kpi: b, max: num(row.getCell(4)), measure: text(row.getCell(5)).replace(/\s+/g, " ").slice(0, 480) });
  });
  return blocks;
}

// ── Role definitions, from each role's Role Clarity Document ───────────
const RCD = {
  teamLead: {
    def: "As the SEO Team Lead you oversee the day-to-day operations of the SEO team, align strategy execution with business goals, ensure deliverables meet quality standards, and report progress to the Head of SEO. You are the bridge between the SEO team and management, mentoring team members and ensuring timely execution of SEO campaigns, and ensuring all SEO activities align with Haris & Co.",
    resp: [
      "Team Management: allocate tasks, provide guidance, conduct performance reviews",
      "Campaign Oversight: plan and implement on-page, off-page and technical SEO strategies",
      "Client Communication: coordinate with account managers for client satisfaction and goal alignment",
      "Quality Control: review deliverables such as keyword research, audit reports and backlink profiles",
      "Training & Development: upskill team members through sessions, workshops and feedback",
      "Reporting: provide SEO performance reports to the Head of SEO and suggest improvements",
      "Client/Project Performance: ensure KPIs (rankings, traffic, conversions) are met",
      "Collaboration: work with content, design and development teams for SEO alignment",
      "Communication: clear and effective communication with the Head of SEO and other departments",
      "Measured on: task completion rate, SEO KPIs, client retention and satisfaction, team productivity, training effectiveness, error rate, reporting accuracy, team satisfaction",
    ],
  },
  strategist: {
    def: "Strategize what activities should be done to fulfil the client's SEO requirements, with the help of other teams such as Content, UI/UX, Development, Outreach and Link Building. The goal is results such as keyword ranking improvements, traffic generation and increased conversions.",
    resp: [
      "Strategize SEO plans based on client needs by researching their industry and competitors",
      "Build a clear SEO strategy with action plans, team coordination and measurable outcomes",
      "Assign, monitor and cross-check junior analysts' tasks and help them grow",
      "Monitoring and quality control: monitor junior analyst tasks, track keyword positions, review weekly and monthly reports",
      "Task assignment: off-page strategy, on-page audits, content creation, backlink creation; set deliverables for juniors",
      "Content, UI/UX and development: assign and review content, wireframes and development tasks, give feedback",
      "Strategy and client management: attend client meetings, create SEO strategies, manage timelines (sub-tasks in Zoho), communicate progress",
      "Reporting and analysis: prepare and review monthly and weekly reports; update the client performance tracking sheet monthly",
      "Measured on: keyword rankings, organic traffic growth and CTR, lead generation and conversion rate, backlink quality and authority, local SEO performance, ROI",
    ],
  },
  developer: {
    def: "The Technical SEO Developer optimizes websites for search engine performance by improving crawlability, indexing, site speed and technical SEO elements. The role bridges SEO and web development, involving coding, integrating SEO best practices into development workflows, and collaborating with content, design and SEO teams to drive organic traffic and improve user experience.",
    resp: [
      "Prepare the technical audit checklist for juniors",
      "Ensure juniors audit the website every month on a set date; audits in the first half of the month, fixes in the second",
      "Fix critical issues with utmost priority",
      "Maintain website performance scores and keep websites updated every month",
      "Research technical SEO strategies",
      "Optimize Core Web Vitals and site speed",
      "Develop clean, SEO-compliant websites and CMS pages",
      "Manage robots.txt, XML sitemaps, canonical and hreflang tags, structured data",
      "Monitor and resolve crawl errors, broken links and indexing issues; plan and support site migrations",
      "Measured on: Core Web Vitals and page load (90+ on Lighthouse), reduction in crawl and 4xx/5xx errors, higher SERP rankings and rich-snippet visibility",
    ],
  },
  analyst: {
    def: "The SEO Analyst improves the visibility and ranking of a website or web pages in search engines through strategic planning and execution of SEO techniques. The role involves keyword research, technical audits, on-page and off-page optimization and performance tracking to drive organic traffic and support business growth.",
    resp: [
      "Conduct detailed keyword research and competitor analysis",
      "Optimize website content and structure for search engines and users",
      "Implement technical SEO best practices; report critical errors to developers and ensure they are fixed quickly",
      "Develop and execute link-building strategies",
      "Track keywords weekly and notify the strategist of any drops; report monthly problems with their cause",
      "CRO: audit the site to identify conversion issues",
      "Collaborate with content creators, UI designers and developers; ensure content quality",
      "Deliverables: SEO strategy and plan, keyword research report, monthly performance reports, on-page recommendations, technical audit report, backlink report",
      "Measured on: organic traffic, keyword rankings, CTR, bounce rate, conversion rate, page load speed, backlink quality, indexed pages, crawl errors",
    ],
  },
  juniorAnalyst: {
    def: "The Junior SEO Analyst supports the SEO team by conducting on-page and off-page optimization activities, gathering and analyzing SEO data, and implementing tactics that improve organic search visibility and traffic for client websites.",
    resp: [
      "Keyword research and targeting: discover keywords, analyze intent and difficulty, maintain a keyword database, map keywords to pages",
      "On-page optimization: titles, meta descriptions, headers, alt text; content quality; SEO-friendly content briefs",
      "Link building and outreach: identify high-authority sites, niche PR and guest-post sites",
      "Technical SEO audits: ensure critical audits are done, test speed and mobile-friendliness, monitor Core Web Vitals and structured data",
      "Performance reporting and analysis: update the performance report, pull data from Analytics and Search Console, present findings",
      "Task updates: meet deadlines, update everything promptly, ensure content quality, suggest strategies, stay aware of client task updates",
      "Measured on: on-page optimization tasks completed, backlinks acquired, report delivery, keyword positioning",
    ],
  },
  juniorWriter: {
    def: "A Jr SEO Content Writer creates, optimises and manages high-quality content that improves organic visibility, drives traffic, and contributes to lead generation and brand authority through search engine optimisation best practices.",
    resp: [
      "Content creation: well-researched SEO-friendly blogs, product-page, landing-page and off-page content every week",
      "SEO optimisation: relevant keywords, meta titles and descriptions, proper headings and internal links",
      "Content strategy and planning: assist the senior writer, prepare topic suggestions, coordinate with the team",
      "Client collaboration: attend client meetings when required, share blogs after a quality check with the research behind them",
      "Measured on: volume and quality of content each month, growth in organic traffic and rankings, professionalism with clients, contribution to planning sessions",
      "Growth path: Senior SEO Content Writer",
    ],
  },
  uiux: {
    def: "The UI/UX Designer creates intuitive, user-centred digital experiences by combining brand and user research, wireframing, visual design and prototyping. The role bridges user needs, technical feasibility and business goals, ensuring consistent and accessible interface design across web and mobile, and collaborates with SEO strategists and content teams.",
    resp: [
      "UI/UX design for web and mobile interfaces: brand study, competitor analysis, wireframes, mockups, prototypes, development handoff",
      "Blog thumbnail creation consistent with the brand's visual language",
      "Coordination with the SEO Strategist on project deliverables",
      "Client communication when there is confusion or a requirement to clarify",
      "Documentation of design systems and asset files",
      "Stay current with UI/UX trends and tools, growing toward a Creative Head position",
      "Measured on: project delivery timelines, client satisfaction, quality and consistency of design, adoption of new features and designs, adherence to design systems, completeness of documentation",
    ],
  },
};

// ── Which sheet tabs make up each scorecard ────────────────────────────
const TEMPLATES: { name: string; tabs: string[]; rcd?: { def: string; resp: string[] } }[] = [
  { name: "SEO Team Lead", tabs: ["TL"], rcd: RCD.teamLead },
  { name: "SEO Strategist", tabs: ["Strategist- Muhsina", "Strategist- Abijith", "Strategist- Shafna", "Strategist- Mahin"], rcd: RCD.strategist },
  { name: "SEO Technical Developer – Lead", tabs: ["Dev- Lead- Jithin"], rcd: RCD.developer },
  { name: "SEO Technical Developer – Junior", tabs: ["Dev- Junior- Shakir"], rcd: RCD.developer },
  { name: "SEO Analyst", tabs: ["Analyst-  Amal", "Analyst-  Harith", "Analyst-  Basith", "Analyst- Ajmal"], rcd: RCD.analyst },
  { name: "SEO Analyst – Junior", tabs: ["Analyst- Junior- Shahinsha"], rcd: RCD.juniorAnalyst },
  { name: "SEO Content Writer – Senior", tabs: ["Content- Senior- Riyas", "Content- Senior- Aravind"] },
  { name: "SEO Content Writer – Junior", tabs: ["Content- Junior- Nidhin"], rcd: RCD.juniorWriter },
  { name: "SEO Content Lead", tabs: ["Content- Lead"] },
  { name: "SEO UI/UX Designer", tabs: ["UIUX- Junior-Shijumon"], rcd: RCD.uiux },
];

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const existing = new Set((await db.perfTemplate.findMany({ select: { name: true } })).map((t) => t.name));

  const plans: { name: string; month: number; main: Row[]; critical: Row[]; wfh: Row[]; rcd?: { def: string; resp: string[] }; from: string }[] = [];
  for (const t of TEMPLATES) {
    // The earliest month (across the tabs) whose scored KPIs total exactly 100.
    let best: { month: number; block: Block; tab: string } | null = null;
    for (const tab of t.tabs) {
      const ws = wb.getWorksheet(tab);
      if (!ws) { console.log(`  ! tab “${tab}” not found`); continue; }
      for (const b of parseTab(ws)) {
        const total = b.main.reduce((s, k) => s + (k.max ?? 0), 0);
        if (total === 100 && (!best || b.month < best.month)) best = { month: b.month, block: b, tab };
      }
    }
    if (!best) { console.log(`${t.name.padEnd(36)} — no month totals 100; NOT loaded`); continue; }
    const main = best.block.main.filter((k) => (k.max ?? 0) > 0);
    plans.push({ name: t.name, month: best.month, main, critical: best.block.critical, wfh: best.block.wfh, rcd: t.rcd, from: `${best.tab}, ${new Date(Date.UTC(2026, best.month - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" })}` });
    const kras = new Set(main.map((k) => k.kra)).size;
    console.log(`${t.name.padEnd(36)} ${String(main.length).padStart(2)} KPIs in ${kras} KRAs = 100 pts | ${best.block.critical.length} critical, ${best.block.wfh.length} WFH | from 2026-${String(best.month).padStart(2, "0")} (${best.tab}) | role definition: ${t.rcd ? "yes" : "none provided"}${existing.has(t.name) ? "  [already exists — skipped]" : ""}`);
  }
  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  for (const p of plans) {
    if (existing.has(p.name)) continue;
    const kras = [...new Set(p.main.map((k) => k.kra))];
    await db.perfTemplate.create({
      data: {
        name: p.name,
        roleDefinition: p.rcd?.def ?? null,
        responsibilities: p.rcd?.resp.join("\n") ?? null,
        versions: {
          create: {
            effectiveFrom: new Date(Date.UTC(2026, p.month - 1, 1)),
            kras: {
              create: kras.map((name, ki) => ({
                name,
                sortOrder: ki,
                kpis: { create: p.main.filter((k) => k.kra === name).map((k, pi) => ({ name: k.kpi, description: k.measure || null, maxPoints: k.max!, sortOrder: pi })) },
              })),
            },
            risks: {
              create: [
                ...p.critical.map((r) => ({ category: `Critical · ${r.kra}`, name: r.kpi, description: r.measure || null, alertLevel: "Critical KPI", deductible: true })),
                ...p.wfh.map((r) => ({ category: `WFH discipline · ${r.kra}`, name: r.kpi, description: r.measure || null, alertLevel: null })),
              ].map((r, i) => ({ ...r, sortOrder: i })),
            },
          },
        },
      },
    });
    console.log(`  created ${p.name}`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
