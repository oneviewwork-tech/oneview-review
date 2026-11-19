/**
 * Web department history for September and October 2026 from the 15
 * "Performance_Report_<Name>_<YYYYMM>.docx" files HR sent (zipped as
 * "New folder.zip"), one per person per month - Web's first-ever history.
 *
 * Unlike every other source so far, these are narrative Word reports, not
 * spreadsheets: each has a "4. Full KPI Scorecard" section with one table
 * per KRA, listing every KPI's weekly values directly (no Total-row
 * guessing needed - the numbers are already there). A .docx is a zip of
 * XML; this shells out to `python3` once per file to unzip
 * word/document.xml and pull every <w:t> run's text, then parses that
 * flat text with regex. Report text is untrusted - it ends up in regex
 * captures only, never executed.
 *
 * All but two people already have the right Review assignment (verified
 * against each report's own stated designation and the KPI names in its
 * scorecard table, not just the designation label, since one report's
 * designation text is stale): Visakh is on "Web - Junior Web Developer"
 * but his report's KRAs are "Project Delivery & Ownership", "...Shopify
 * features/tools" etc, matching "Web - Senior Shopify Developer" instead -
 * reassigned. Arshad (Project Manager) had no assignment at all - the
 * "Web - Project Manager" template already exists (Sangeeth's), so he
 * just gets added to it. Every template's one version is dated October
 * 2026 (when they were first set up) but the KRA/KPI structure is
 * unchanged back to September (verified by diffing Shabeer's two
 * reports), so versions are backdated rather than duplicated.
 *
 *   npx tsx prisma/seed-web-docx.ts            # dry run
 *   npx tsx prisma/seed-web-docx.ts --apply
 */
import { execFileSync } from "node:child_process";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();
const m = (mm: number) => new Date(Date.UTC(2026, mm, 1));
const BASE = "C:/Users/ASUS/AppData/Local/Temp/claude/webkpi-extract/New folder";

const FILES: { file: string; period: Date; email: string; template: string }[] = [
  { file: `${BASE}/Sept/Performance_Report_Shabeer_202609.docx`, period: m(8), email: "shabeerpk@harisand.co", template: "Web – Junior UI/UX Designer" },
  { file: `${BASE}/Sept/Performance_Report_Dikra-Muneer_202609.docx`, period: m(8), email: "dikra@harisand.co", template: "Web – Junior Web Developer" },
  { file: `${BASE}/Sept/Performance_Report_Manal-Abdul-Hameed-Mannil_202609.docx`, period: m(8), email: "manal@harisand.co", template: "Web – Content Writer" },
  { file: `${BASE}/Sept/Performance_Report_Muhammed-Shifin_202609.docx`, period: m(8), email: "shifin@harisand.co", template: "Web – Junior Full Stack Developer" },
  { file: `${BASE}/Sept/Performance_Report_Riya-Ummer-M-V_202609.docx`, period: m(8), email: "riya@harisand.co", template: "Web – Junior QA/QC Tester" },
  { file: `${BASE}/Sept/Performance_Report_Shiju-KG_202609.docx`, period: m(8), email: "shiju@harisand.co", template: "Web – Senior UI/UX Designer" },
  { file: `${BASE}/Sept/Performance_Report_Visakh-C-K_202609.docx`, period: m(8), email: "visakh@harisand.co", template: "Web – Senior Shopify Developer" },
  { file: `${BASE}/Oct/Performance_Report_Shabeer_202610.docx`, period: m(9), email: "shabeerpk@harisand.co", template: "Web – Junior UI/UX Designer" },
  { file: `${BASE}/Oct/Performance_Report_Dikra-Muneer_202610.docx`, period: m(9), email: "dikra@harisand.co", template: "Web – Junior Web Developer" },
  { file: `${BASE}/Oct/Performance_Report_Manal-Abdul-Hameed-Mannil_202610.docx`, period: m(9), email: "manal@harisand.co", template: "Web – Content Writer" },
  { file: `${BASE}/Oct/Performance_Report_Muhammed-Shifin_202610.docx`, period: m(9), email: "shifin@harisand.co", template: "Web – Junior Full Stack Developer" },
  { file: `${BASE}/Oct/Performance_Report_Riya-Ummer-M-V_202610.docx`, period: m(9), email: "riya@harisand.co", template: "Web – Junior QA/QC Tester" },
  { file: `${BASE}/Oct/Performance_Report_Shiju-KG_202610.docx`, period: m(9), email: "shiju@harisand.co", template: "Web – Senior UI/UX Designer" },
  { file: `${BASE}/Oct/Performance_Report_Visakh-C-K_202610.docx`, period: m(9), email: "visakh@harisand.co", template: "Web – Senior Shopify Developer" },
  { file: `${BASE}/Oct/Performance_Report_Arshad-Kallarakkal-Thazhe_202610.docx`, period: m(9), email: "arshadkt@harisand.co", template: "Web – Project Manager" },
];

const keyOf = (s: string) => s.toLowerCase().replace(/&amp;/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

function extractText(file: string): string {
  const py = `
import re, zipfile, sys
sys.stdout.reconfigure(encoding="utf-8")
with zipfile.ZipFile(r"${file}") as z:
    xml = z.read("word/document.xml").decode("utf-8")
texts = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', xml)
print(" ".join(texts))
`;
  const raw = execFileSync("python3", ["-c", py], { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  // XML entities survive the <w:t> extraction as literal text (e.g. "&amp;"
  // for every "&"), so unescape them here - otherwise keyOf() diverges from
  // the template's own KPI names, which hold real "&" characters already.
  return raw.replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

interface Parsed { finalScore: number; weeks: { label: string; kpis: Map<string, number> }[] }

function parseReport(text: string): Parsed {
  const scorecard = /4\. Full KPI Scorecard.*?FINAL SCORE[\s\S]*?(?=\s*5\. Improvement)/.exec(text)?.[0];
  if (!scorecard) throw new Error("no 'Full KPI Scorecard' section found");

  // Week-date headers for this report, e.g. "Week 08/10" x N, read once
  // from the first KRA block (every block repeats the same week columns).
  const headerMatch = /KPI \/ Description Max ((?:Week \d{2}\/\d{2} )+)Avg %/.exec(scorecard);
  if (!headerMatch) throw new Error("no week header row found");
  const weekLabels = headerMatch[1].trim().split(/\s+/).filter((_, i) => i % 2 === 1); // "Week","08/10","Week","15/10",... -> dates only
  const weeks: Parsed["weeks"] = weekLabels.map((label) => ({ label, kpis: new Map<string, number>() }));

  // Each KPI row is "<name tokens...> <max> <v1> <v2> ... <vN> <avg> <pct%>".
  // A single greedy-vs-lazy regex can't tell where a punctuation-heavy name
  // ends and the numbers begin (names here include colons, commas, slashes),
  // so this walks the block's whitespace-split tokens directly: everything
  // up to the first purely-numeric token is the name, then the next N+2
  // numeric tokens are max/weeks.../avg, and the token after those must be
  // "NN%" or the row is malformed and skipped rather than guessed at.
  const n = weeks.length;
  const isNum = (t: string) => /^\d+(?:\.\d+)?$/.test(t);
  const kraBlocks = scorecard.split("📌").slice(1);
  for (const block of kraBlocks) {
    const rows = block.split(/KPI \/ Description Max (?:Week \d{2}\/\d{2} )+Avg %/)[1] ?? "";
    const body = rows.split("FINAL SCORE")[0];
    const tokens = body.trim().split(/\s+/).filter(Boolean);
    let i = 0;
    while (i < tokens.length) {
      const nameTokens: string[] = [];
      while (i < tokens.length && !isNum(tokens[i])) nameTokens.push(tokens[i++]);
      if (i >= tokens.length) break;
      const numTokens = tokens.slice(i, i + n + 2); // max, week1..weekN, avg
      if (numTokens.length < n + 2 || !numTokens.every(isNum)) break; // ran out, or hit something unexpected
      const pct = tokens[i + n + 2];
      if (!/^\d+(?:\.\d+)?%$/.test(pct ?? "")) break;
      const name = nameTokens.join(" ").replace(/\.$/, "");
      const nums = numTokens.slice(1, 1 + n).map(Number); // drop max, keep the N week values
      for (let w = 0; w < n; w++) weeks[w].kpis.set(keyOf(name), nums[w]);
      i += n + 3; // numTokens + the pct token
    }
  }

  const finalScoreMatch = /Final Monthly Score (\d+(?:\.\d+)?)\/100/.exec(text);
  if (!finalScoreMatch) throw new Error("no 'Final Monthly Score' found");
  return { finalScore: Number(finalScoreMatch[1]), weeks: weeks.filter((w) => w.kpis.size > 0) };
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");

  const employees = await db.employee.findMany({
    where: { email: { in: [...new Set(FILES.map((f) => f.email))] } },
    select: { id: true, name: true, email: true, perfAssignment: { select: { id: true, templateId: true, scorerUserId: true, template: { select: { name: true } } } } },
  });

  // Visakh: reassign to the template his report's KRAs actually match.
  const visakh = employees.find((e) => e.email.toLowerCase() === "visakh@harisand.co");
  if (visakh?.perfAssignment && visakh.perfAssignment.template.name !== "Web – Senior Shopify Developer") {
    const target = await db.perfTemplate.findFirst({ where: { name: "Web – Senior Shopify Developer" }, select: { id: true } });
    console.log(`  ~ ${visakh.name}: ${visakh.perfAssignment.template.name} -> Web – Senior Shopify Developer`);
    if (APPLY) await db.perfAssignment.update({ where: { id: visakh.perfAssignment.id }, data: { templateId: target!.id } });
  }

  // Arshad: first-time assignment to Project Manager, same scorer as Sangeeth (the existing PM).
  const arshad = employees.find((e) => e.email.toLowerCase() === "arshadkt@harisand.co");
  if (arshad && !arshad.perfAssignment) {
    const sangeeth = await db.employee.findFirst({ where: { email: "sangeeth@harisand.co" }, select: { perfAssignment: { select: { templateId: true, scorerUserId: true } } } });
    if (sangeeth?.perfAssignment) {
      console.log(`  + assign ${arshad.name} -> Web – Project Manager, scored by the same person as Sangeeth`);
      if (APPLY) await db.perfAssignment.create({ data: { employeeId: arshad.id, templateId: sangeeth.perfAssignment.templateId, scorerUserId: sangeeth.perfAssignment.scorerUserId } });
    } else {
      console.log(`  ! Arshad: Sangeeth has no assignment to copy a scorer from; cannot assign`);
    }
  }

  // Backdate each involved template's single version to September, since
  // the KRA/KPI structure is unchanged (verified against Shabeer's two
  // reports) and this is the earliest month these reports cover.
  const templateNames = [...new Set(FILES.map((f) => f.template))];
  for (const name of templateNames) {
    const t = await db.perfTemplate.findFirst({ where: { name }, include: { versions: true } });
    if (!t || t.versions.length !== 1) { console.log(`  ! ${name}: expected exactly 1 version, found ${t?.versions.length ?? 0}; skipped backdating`); continue; }
    const v = t.versions[0];
    if (+v.effectiveFrom <= +m(8)) continue;
    console.log(`  ~ ${name}: version ${v.effectiveFrom.toISOString().slice(0, 7)} -> 2026-09`);
    if (APPLY) await db.perfTemplateVersion.update({ where: { id: v.id }, data: { effectiveFrom: m(8) } });
  }

  if (!APPLY) {
    console.log("\n--- Reports found ---");
    for (const f of FILES) {
      const text = extractText(f.file);
      const parsed = parseReport(text);
      const e = employees.find((x) => x.email.toLowerCase() === f.email.toLowerCase());
      console.log(`  ${f.period.toISOString().slice(0, 7)} ${(e?.name ?? f.email).padEnd(22)} ${f.template.padEnd(32)} finalScore=${parsed.finalScore} weeks=${parsed.weeks.length} kpisPerWeek=${parsed.weeks[0]?.kpis.size ?? 0}`);
    }
    return console.log("\nNothing was written. Re-run with --apply.");
  }

  const employees2 = await db.employee.findMany({ where: { email: { in: [...new Set(FILES.map((f) => f.email))] } }, select: { id: true, name: true, email: true, perfAssignment: { select: { templateId: true, scorerUserId: true } } } });
  const reviews = await db.perfReview.findMany({ select: { employeeId: true, period: true } });
  const done = new Set(reviews.map((r) => `${r.employeeId}|${r.period.toISOString().slice(0, 7)}`));
  const templates = await db.perfTemplate.findMany({ where: { name: { in: templateNames } }, include: { versions: { include: { kras: { include: { kpis: true } } } } } });
  const templateByName = new Map(templates.map((t) => [t.name, t]));

  for (const f of FILES) {
    const e = employees2.find((x) => x.email.toLowerCase() === f.email.toLowerCase());
    if (!e || !e.perfAssignment) { console.log(`  ! ${f.email}: no Review employee/assignment; skipped`); continue; }
    const ym = f.period.toISOString().slice(0, 7);
    if (done.has(`${e.id}|${ym}`)) continue;

    const text = extractText(f.file);
    const parsed = parseReport(text);
    const template = templateByName.get(f.template)!;
    const version = template.versions.filter((v) => +v.effectiveFrom <= +f.period).sort((a, b) => +b.effectiveFrom - +a.effectiveFrom)[0];
    if (!version) { console.log(`  ! ${e.name} ${ym}: no version in force; skipped`); continue; }
    const kpiId = new Map(version.kras.flatMap((k) => k.kpis).map((k) => [keyOf(k.name), k.id]));
    const maxScore = version.kras.reduce((s, k) => s + k.kpis.reduce((s2, x) => s2 + x.maxPoints, 0), 0);
    const scorer = e.perfAssignment.scorerUserId;
    const now = new Date();
    const scoreRows: Prisma.PerfScoreCreateManyInput[] = parsed.weeks.flatMap((week, i) =>
      [...week.kpis.entries()].flatMap(([key, value]) => {
        const id = kpiId.get(key);
        return id ? [{ employeeId: e.id, kpiId: id, period: f.period, week: i + 1, value, remark: `Week of ${week.label}, imported from Web performance report`, enteredById: scorer, enteredByName: "Imported from Web performance report" }] : [];
      }),
    );
    if (!scoreRows.length) { console.log(`  ! ${e.name} ${ym}: no KPI names matched the template; skipped (check keyOf normalization)`); continue; }
    await db.$transaction(async (tx) => {
      await tx.perfScore.createMany({ data: scoreRows, skipDuplicates: true });
      await tx.perfReview.create({ data: { employeeId: e.id, period: f.period, status: "CONFIRMED", submittedById: scorer, submittedByName: "Imported from Web performance report", submittedAt: now, decidedById: scorer, decidedByName: "Imported from Web performance report", decidedAt: now, finalScore: parsed.finalScore, maxScore, weeksScored: parsed.weeks.length } });
      await writeAuditEvent(tx, { entityType: "PerfReview", entityId: e.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { finalScore: parsed.finalScore, scores: scoreRows.length }, metadata: { source: "web-docx-import", period: ym } });
    });
    console.log(`  recorded ${ym} ${e.name} = ${parsed.finalScore} (${scoreRows.length} KPI scores across ${parsed.weeks.length} weeks)`);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
