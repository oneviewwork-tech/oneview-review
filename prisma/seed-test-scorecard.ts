/**
 * TEST DATABASE ONLY. Adds one demo scorecard (100 points, with deductible
 * critical KPIs) and the scoring chain for the test logins:
 *
 *   Dana Head    scores Riya Manager   (so Dana reviews what Riya submits)
 *   Riya Manager scores Eli Employee
 *
 * Run seed-test-logins.ts first. No scores are entered. Refuses to run unless
 * DATABASE_URL points at localhost. Safe to re-run.
 *
 *   DATABASE_URL="postgresql://postgres:localtest@127.0.0.1:55433/oneview_test?schema=review" \
 *     npx tsx prisma/seed-test-scorecard.ts
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing: DATABASE_URL is not a local database.");
  process.exit(1);
}
const db = new PrismaClient({ datasources: { db: { url } } });

const NAME = "Demo Scorecard";
// From September, so last month and this month can both be tested.
const FROM = new Date(Date.UTC(2026, 8, 1));

// Same shape as HR's real scorecards (Web / PM): five KRAs of 20 points,
// each a 10 + 5 + 5 split, and the critical KPIs below them.
const KRAS: { name: string; kpis: [string, number, string][] }[] = [
  {
    name: "Project Delivery",
    kpis: [
      ["On-time delivery & consistent execution", 10, "Tasks delivered by the agreed deadline"],
      ["Handle multiple tasks efficiently", 5, "Manages parallel work without slippage"],
      ["Workload management & meeting deadlines", 5, "Plans the week and flags risks early"],
    ],
  },
  {
    name: "Work Quality",
    kpis: [
      ["Accurate, error-free output", 10, "Work accepted without major rework"],
      ["Reduce rework", 5, "Revisions per task kept low"],
      ["Follow standards & SOPs", 5, "Uses the agreed process and checklists"],
    ],
  },
  {
    name: "Requirement Understanding",
    kpis: [
      ["Understand requirements", 10, "Clarifies the brief before starting"],
      ["Translate requirements into output", 5, "Delivers what was actually asked for"],
      ["Clear doubts early", 5, "Raises questions before, not after, delivery"],
    ],
  },
  {
    name: "Collaboration & Communication",
    kpis: [
      ["Team coordination & clear communication", 10, "Keeps the team and lead informed"],
      ["Active participation in feedback", 3, "Engages in reviews and acts on input"],
      ["Smooth collaboration with stakeholders", 2, "Works well across teams"],
      ["Availability & Responsiveness", 5, "Reachable for meetings; replies promptly in working hours"],
    ],
  },
  {
    name: "Ownership, Learning & Growth",
    kpis: [
      ["Takes ownership & works independently", 10, "Drives tasks to completion without follow-ups"],
      ["Proactively solves problems", 5, "Spots issues and proposes fixes"],
      ["Continuous learning", 5, "Learns and applies new tools or skills"],
    ],
  },
];

// [group, item, most that can be deducted in a month]
const CRITICAL = [
  ["Delivery Impact Delay", "Missing deadlines that block next stage", 10],
  ["Delivery Impact Delay", "Delay in assigned tasks impacting overall project", 10],
  ["Delivery Impact Delay", "Poor planning causing delivery slippage", 10],
  ["Unauthorized Decision Impact", "Making decisions without senior/lead approval", 20],
  ["Unauthorized Decision Impact", "Direct client communication without alignment", 20],
  ["Unauthorized Decision Impact", "Implementing changes without review/QA check", 10],
  ["Unauthorized Decision Impact", "Skipping defined process (SOP / approval flow)", 10],
  ["Professional Behavior", "Unprofessional attitude", 10],
  ["Professional Behavior", "Conflicts with team members", 10],
  ["Professional Behavior", "Ignoring feedback / resistance to correction", 10],
  ["Professional Behavior", "Disrespectful communication (internal or client)", 10],
  ["Professional Behavior", "Lack of accountability", 10],
  ["Availability Failure (Critical)", "Not available during working hours", 10],
  ["Availability Failure (Critical)", "Delayed responses during active tasks", 5],
  ["Availability Failure (Critical)", "Missing from meetings / team syncs / critical discussions", 5],
  ["Availability Failure (Critical)", "Going offline without prior update", 5],
  ["Daily Reporting Failure (Critical)", "Missing morning check-in", 5],
  ["Daily Reporting Failure (Critical)", "Missing end-of-day (EOD) report", 5],
  ["Daily Reporting Failure (Critical)", "Incomplete / unclear updates", 5],
  ["Daily Reporting Failure (Critical)", "No status clarity (Done / Pending / Blocked)", 5],
  ["Client Churn", "Client lost due to poor delivery", 30],
  ["Deliverables Failure", "Monthly deliverables below 90%", 30],
] as const;

async function main() {
  const total = KRAS.flatMap((k) => k.kpis).reduce((sum, k) => sum + k[1], 0);
  if (total !== 100) throw new Error(`Demo scorecard totals ${total}, not 100.`);

  let template = await db.perfTemplate.findFirst({ where: { name: NAME } });
  // An earlier demo with no scores yet is replaced, so the latest shape applies.
  if (template && (await db.perfScore.count({ where: { kpi: { kra: { version: { templateId: template.id } } } } })) === 0) {
    await db.perfAssignment.deleteMany({ where: { templateId: template.id } });
    await db.perfTemplate.delete({ where: { id: template.id } });
    console.log(`replaced the earlier ${NAME}`);
    template = null;
  }
  if (!template) {
    template = await db.perfTemplate.create({
      data: {
        name: NAME,
        roleDefinition: "A demo role for testing the scoring, review and HR workflow end to end.",
        responsibilities: "Deliver assigned work on time\nKeep the team updated daily\nAct on feedback",
        versions: {
          create: {
            effectiveFrom: FROM,
            kras: {
              create: KRAS.map((k, ki) => ({
                name: k.name,
                sortOrder: ki,
                kpis: { create: k.kpis.map(([name, max, description], i) => ({ name, maxPoints: max, description, sortOrder: i })) },
              })),
            },
            risks: {
              create: CRITICAL.map(([category, name, maxPenalty], i) => ({
                category,
                name,
                alertLevel: "Critical KPI",
                deductible: true,
                maxPenalty,
                sortOrder: i,
              })),
            },
          },
        },
      },
    });
    console.log(`created ${NAME}: ${KRAS.length} KRAs, ${total} pts, ${CRITICAL.length} critical KPIs`);
  } else {
    console.log(`${NAME} already exists`);
  }

  const user = (email: string) => db.user.findUniqueOrThrow({ where: { email } });
  const employee = (email: string) => db.employee.findFirstOrThrow({ where: { email } });
  const chain = [
    { who: "manager@test.local", scorer: "head@test.local" },
    { who: "employee@test.local", scorer: "manager@test.local" },
  ];
  for (const c of chain) {
    const [emp, scorer] = await Promise.all([employee(c.who), user(c.scorer)]);
    await db.perfAssignment.upsert({
      where: { employeeId: emp.id },
      create: { employeeId: emp.id, templateId: template.id, scorerUserId: scorer.id },
      update: { templateId: template.id, scorerUserId: scorer.id },
    });
    console.log(`${emp.name} → ${NAME}, scored by ${scorer.name}`);
  }
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
