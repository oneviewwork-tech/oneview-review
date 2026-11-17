/**
 * Loads the Quality Lead – Student Experience scorecard (Monisha M) from the
 * "Quality LAED" sheet HR shared, its critical KPIs, her August scores, and
 * makes Ibrahim Saheel her scorer.
 *
 * The SEP and NOV tabs of that sheet are empty, so only August scores exist.
 * August is recorded as a confirmed, imported test month, like the other
 * history imports. Safe to re-run: existing versions, assignments and scores
 * are left alone.
 *
 *   npx tsx prisma/seed-quality-lead.ts            # dry run
 *   npx tsx prisma/seed-quality-lead.ts --apply
 */
import { writeAuditEvent } from "../src/lib/audit";
import { matchByName } from "../src/domain/people/match";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();
const TEMPLATE = "Quality Lead – Student Experience";
const FROM = new Date(Date.UTC(2026, 7, 1)); // August 2026

// [KRA, [KPI, weight, score awarded in each of weeks 1-4]]
const KRAS: [string, [string, number, number][]][] = [
  ["Student Experience Team Leadership", [["SHO / SEM Operational Compliance", 5, 5], ["Weekly Team Performance Review Completion", 5, 5], ["Student Experience SOP Adherence", 5, 5]]],
  [
    "Academic Session Quality Monitoring",
    [["Average Class Quality Score", 6, 4], ["Trainer / Session Quality Review Completion", 4, 3], ["Curriculum & Session Plan Compliance", 3, 2], ["Student Support Resolution Rate", 3, 3], ["Session Quality Issue Detection & Escalation", 4, 3]],
  ],
  [
    "Student Learning & Engagement Monitoring",
    [["Assignment Completion Rate", 7, 5], ["Student Participation / Engagement Score", 8, 7], ["Batch Engagement Health", 5, 5], ["Early Risk Identification & Intervention Rate", 5, 3]],
  ],
  ["Escalation Management & Student Experience", [["Student Satisfaction Score", 3, 2], ["Escalation Resolution SLA", 4, 4], ["Recurring Complaint Closure / Prevention Rate", 3, 3]]],
  [
    "Academic Process Governance & Reporting",
    [["Academic Audit Completion", 5, 5], ["Curriculum Delivery Compliance", 5, 5], ["Weekly Quality Report Submission", 5, 5], ["Quality Dashboard & Reporting Accuracy", 5, 5]],
  ],
  ["Quality Improvement & Academic Leadership", [["Corrective Actions Implemented", 4, 4], ["Process Improvements Implemented", 3, 3], ["Trainer / Faculty Development Actions", 3, 3]]],
];

// Critical KPIs from the sheet; alert levels are from the role's RCD.
const RISKS: [string, string][] = [
  ["Low Class Quality Score", "Below 70%"],
  ["Low Student Engagement", "Below 60%"],
  ["Curriculum Deviation", "More than 15% deviation"],
  ["Negative Student Feedback", "More than 10% consistent complaints"],
  ["Delayed QA Reviews", "More than 1 week delay"],
  ["Batch Drop in Participation", "Significant decline in assignment submissions"],
];

async function main() {
  const total = KRAS.flatMap(([, k]) => k).reduce((s, [, w]) => s + w, 0);
  const awarded = KRAS.flatMap(([, k]) => k).reduce((s, [, , v]) => s + v, 0);
  if (total !== 100) throw new Error(`Weights add up to ${total}, expected 100.`);
  console.log(APPLY ? "APPLY" : "DRY RUN", `\nWeights: ${total}. Weekly score: ${awarded} (the sheet's own total is 89).`);
  if (awarded !== 89) throw new Error("Scores don't add up to the sheet's 89 — not loading.");

  const template = await db.perfTemplate.findUniqueOrThrow({ where: { name: TEMPLATE } });
  const monisha = matchByName(
    "Monisha M",
    (await db.employee.findMany({ where: { isActive: true, organization: { code: "HACA" } }, select: { id: true, name: true } }))
  );
  if (monisha.kind !== "exact" && monisha.kind !== "partial") throw new Error("Monisha M isn't an active HACA employee in Review.");
  const employee = monisha.match;

  // Saheel: whoever already scores the Academic Leads.
  const academic = await db.perfTemplate.findUniqueOrThrow({ where: { name: "Academic Lead" } });
  const lead = await db.perfAssignment.findFirstOrThrow({ where: { templateId: academic.id }, select: { scorerUserId: true, scorer: { select: { name: true } } } });
  console.log(`Employee: ${employee.name}\nScorer:   ${lead.scorer.name} (scores the Academic Leads)`);

  const [version, assignment, scoreCount, review] = await Promise.all([
    db.perfTemplateVersion.findUnique({ where: { templateId_effectiveFrom: { templateId: template.id, effectiveFrom: FROM } } }),
    db.perfAssignment.findUnique({ where: { employeeId: employee.id } }),
    db.perfScore.count({ where: { employeeId: employee.id, period: FROM } }),
    db.perfReview.findUnique({ where: { employeeId_period: { employeeId: employee.id, period: FROM } } }),
  ]);
  console.log(`Scorecard version: ${version ? "exists" : "to create"} | assignment: ${assignment ? "exists" : "to create"} | August scores: ${scoreCount ? `${scoreCount} already` : "to write"}`);
  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  await db.$transaction(
    async (tx) => {
      const v =
        version ??
        (await tx.perfTemplateVersion.create({
          data: {
            templateId: template.id,
            effectiveFrom: FROM,
            kras: { create: KRAS.map(([name, kpis], ki) => ({ name, sortOrder: ki, kpis: { create: kpis.map(([n, w], pi) => ({ name: n, maxPoints: w, sortOrder: pi })) } })) },
            risks: { create: RISKS.map(([name, alertLevel], i) => ({ category: "Critical KPI", name, alertLevel, sortOrder: i })) },
          },
        }));
      if (!assignment) {
        await tx.perfAssignment.create({ data: { employeeId: employee.id, templateId: template.id, scorerUserId: lead.scorerUserId } });
        await writeAuditEvent(tx, { entityType: "PerfAssignment", entityId: employee.id, action: "PERF_ASSIGNMENT_SAVED", actorUserId: null, actorEmail: null, metadata: { source: "quality-lead-seed", employeeName: employee.name, scorerName: lead.scorer.name } });
      }
      if (scoreCount === 0) {
        const kpis = await tx.perfKpi.findMany({ where: { kra: { versionId: v.id } }, select: { id: true, name: true } });
        const id = new Map(kpis.map((k) => [k.name, k.id]));
        const rows = [1, 2, 3, 4].flatMap((week) =>
          KRAS.flatMap(([, ks]) => ks.map(([n, , score]) => ({ employeeId: employee.id, kpiId: id.get(n)!, period: FROM, week, value: score, enteredById: lead.scorerUserId, enteredByName: "Imported from HR sheet (Quality LAED · AUG)" })))
        );
        await tx.perfScore.createMany({ data: rows, skipDuplicates: true });
        if (!review) {
          const now = new Date();
          await tx.perfReview.create({
            data: { employeeId: employee.id, period: FROM, status: "CONFIRMED", submittedById: lead.scorerUserId, submittedByName: "Imported from HR sheet", submittedAt: now, decidedById: lead.scorerUserId, decidedByName: "Imported from HR sheet", decidedAt: now, finalScore: awarded, maxScore: 100, weeksScored: 4 },
          });
        }
        await writeAuditEvent(tx, { entityType: "PerfScore", entityId: employee.id, action: "PERF_SCORE_SAVED", actorUserId: null, actorEmail: null, after: { scores: rows.length }, metadata: { source: "history-import", file: "Quality LAED · AUG", period: "2026-08", employeeName: employee.name } });
      }
    },
    { maxWait: 20_000, timeout: 120_000 }
  );
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
