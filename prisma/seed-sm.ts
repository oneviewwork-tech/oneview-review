/**
 * Loads the Haris & Co. Social Media department's scorecards from HR's
 * "KPI KRA METRICS WITH ROLE CLARITY" PDFs, and assigns the people to them.
 *
 * The PDFs rate every KPI 0-10 and scale each KRA group to its allocation:
 *   KRA score = (sum of ratings / (10 x KPIs)) x allocation
 * That is the same as giving each KPI a maximum of allocation / KPIs points,
 * so that is how they are stored (some maxima are fractional, e.g. 23 / 2).
 *
 * Critical categories become deductible risks capped at the category's
 * deduction (one row per category, so a category is never deducted twice).
 * Where a PDF gives no amount, the risk is shown but not deductible.
 *
 * Scorer = the employee's Team Lead in People (dottedLineManagerId); if that
 * is empty, their reporting manager. The scorer needs a Review login.
 *
 * Nothing existing is overwritten, and no scores are imported.
 *
 *   npx tsx prisma/seed-sm.ts            # dry run
 *   npx tsx prisma/seed-sm.ts --apply
 */
import { PEOPLE_MANAGED } from "../src/lib/people-managed";
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const ORG = "HARISCO";
const FROM = new Date(Date.UTC(2026, 9, 1)); // October 2026
const db = reviewClient();

type K = [kpi: string, metric: string];
interface Kra { name: string; points: number; kpis: K[] }
interface Risk { category: string; name: string; description: string; deduct: number | null }
interface Card { name: string; def?: string; kras: Kra[]; risks: Risk[]; people: string[] }

const UDI = (d: number | null): Risk => ({
  category: "Unauthorized Decision Impact",
  name: "Decisions without approval / Negative client impact",
  description: "Taking decisions without senior/lead approval, or executing updates or actions without prior review, approval or quality check; or actions leading to negative client impact. One deduction for the category.",
  deduct: d,
});
const CHURN = (d: number | null): Risk => ({ category: "Client Churn", name: "Client lost due to poor delivery", description: "Any client lost due to poor delivery, missed commitments, weak communication or lack of ownership.", deduct: d });
const DELIV = (d: number | null): Risk => ({ category: "Deliverables Failure", name: "Monthly deliverables completion below 90%", description: "Missed timelines, incomplete scope delivery, or a gap between commitment and execution.", deduct: d });
const COLLAB: Kra = { name: "Overall Collaboration", points: 20, kpis: [["Team Collaboration", "Team involvement and contribution"], ["Ownership and Leadership", "Ownership and leadership on team activities and problem solving"]] };

const CARDS: Card[] = [
  {
    name: "Social Media – Social Media Manager",
    def: "Owns the complete management and execution of social media for 5-6 assigned client brands: strategy, client coordination, campaigns, internal team management, quality control and performance.",
    kras: [
      { name: "Brand Growth", points: 30, kpis: [["Follower Growth", "% increase per month"], ["Engagement Rate", "(Likes + Comments + Shares) / Reach"], ["Campaign Performance", "CPC (Cost Per Click)"]] },
      { name: "Quality", points: 15, kpis: [["Revision / Rejection Rate", "% of re-edits from client side"], ["Moment Marketing Initiatives", "Scope versus initiatives"]] },
      { name: "Execution", points: 15, kpis: [["On-time Delivery", "At least 95% of posts delivered on schedule"], ["Delivery Rate", "At least 95% delivery"], ["Directly Impacted Delays", "Any delay that directly impacted overall project delivery"]] },
      { name: "Client Management", points: 20, kpis: [["Client Satisfaction", "Feedback score / retention"], ["Turnaround Time", "Delivery within deadlines"]] },
      COLLAB,
    ],
    risks: [UDI(20), CHURN(20), DELIV(20)],
    people: ["parita@harisand.co"],
  },
  {
    name: "Social Media – Content Lead",
    kras: [
      { name: "Team Performance", points: 23, kpis: [["Team KPI Achievement", "Average KPI score of Content Writers"], ["Team Productivity", "Planned content vs delivered content"]] },
      { name: "Delivery & Quality", points: 43, kpis: [["On-time Content Delivery", "(Delivered on time / Total deliverables) x 100"], ["Revision Reduction", "Average revision rate per content"], ["Brand Consistency", "Internal quality audit score"], ["First Draft Approval Rate", "(Approved first drafts / Total drafts) x 100"]] },
      { name: "Leadership", points: 21, kpis: [["Campaign Strategy Contribution", "Approved campaign concepts & ideas"], ["Creative Innovation", "New content formats / trend implementation"], ["Team Development", "Improvement in writer performance"]] },
      { name: "Business Contribution", points: 13, kpis: [["Process Improvement", "Workflow improvements implemented"], ["Cross-team Collaboration", "Feedback from Production & Social Media teams"]] },
    ],
    risks: [
      { category: "Client Impact", name: "Client dissatisfaction / Delivery failure / Quality failure", description: "Escalations caused by content quality, missed deadlines impacting production, or high rejection / revision rate. One deduction for the category.", deduct: 20 },
      { category: "Risk Management", name: "Unauthorized decisions / Leadership failure", description: "Unauthorized publishing or creative decisions, or team failures due to poor supervision. One deduction for the category.", deduct: 40 },
    ],
    people: ["munawar@harisand.co"],
  },
  {
    name: "Social Media – Writer",
    def: "Creates engaging, brand-aligned content across social platforms: copy for posts, stories and short-form content, and scripts, executing content plans under the guidance of senior writers.",
    kras: [
      { name: "Script Writing", points: 20, kpis: [["Approval Rate", "% scripts approved in first draft (target 80%+)"], ["Revision Rate", "Average number of edits per script"]] },
      { name: "Creativity", points: 15, kpis: [["Viral Contribution", "% of high-performing / viral posts"], ["Trend Utilization", "% of content aligned with trending topics"], ["Campaign Contribution", "Ideas contributed to campaigns"]] },
      { name: "Content Performance", points: 25, kpis: [["Engagement Rate", "Likes, shares, comments per post"], ["New Format Testing", "% new content formats tested per month"]] },
      { name: "Learning Ability", points: 15, kpis: [["Skill Improvement", "% improvement in performance over time"]] },
      { ...COLLAB, points: 25 },
    ],
    risks: [UDI(20), CHURN(20), DELIV(20)],
    people: ["shaheer@harisand.co", "albert@harisand.co", "ayaan@harisand.co", "navneethsurendran@harisand.co"],
  },
  {
    name: "Social Media – Director of Photography",
    kras: [
      { name: "Execution & Delivery", points: 30, kpis: [["Shoot Success", "% shoots without reshoot"], ["Footage Handover", "Within deadline"], ["Reshoots", "% of reshoots"]] },
      { name: "Quality", points: 20, kpis: [["Visual Score", "Internal rating / 10"]] },
      COLLAB,
      { name: "Equipment", points: 20, kpis: [["Damage Control", "Zero damage / loss"]] },
      // The PDF repeats the "Overall Collaboration" name for this 10-point group.
      { name: "Approvals & Client Impact", points: 10, kpis: [["Decisions without approval", "Taking decisions without senior/lead approval, or acting without prior review, approval or quality check"], ["Negative client impact", "Actions leading to negative client impact"]] },
    ],
    risks: [
      { category: "Discipline and Conduct", name: "Process compliance / Professional conduct", description: "Adherence to production workflows and approval systems; professional behaviour and team discipline. One deduction for the category.", deduct: 20 },
      { category: "Attendance & Operational Reliability", name: "Consistent attendance, punctuality and reliability", description: "Delivery, missed commitments, communication and ownership (metric text is partly cut off in the source sheet).", deduct: 20 },
      DELIV(20),
    ],
    people: ["shafi@harisand.co"],
  },
  {
    name: "Social Media – Production Associate / Junior DOP",
    def: "Supports the Director of Photography in day-to-day production: pre-production planning, logistics, props and equipment; on-set camera, lighting and shoot support; and post-production file management and delivery coordination.",
    kras: [
      { name: "Execution & Delivery", points: 50, kpis: [["Shoot Readiness & Preparation", "% of assigned shoots with equipment, props, locations and shot lists ready before the shoot"], ["Shoot Execution & Coverage", "% of assigned shoots supported per the approved brief and shot list"], ["Footage Handover & File Management", "% of shoots with raw footage transferred, labelled and organised into the designated folders"]] },
      { name: "Equipment & Asset Accountability", points: 25, kpis: [["Equipment & Asset Accountability", "Handling, transport, charging, cleaning, inventory logging and return of equipment"]] },
      { name: "Process Compliance & Ownership", points: 25, kpis: [["Process Compliance & Ownership", "Approved workflows, reporting lines and authorisation; punctuality and ownership of assigned work"]] },
    ],
    risks: [
      { category: "Critical Production Failure", name: "Critical Production Failure", description: "Preventable shoot cancellations, failure to capture essential footage, or major delays from incomplete preparation or support.", deduct: 10 },
      { category: "Critical Equipment & Data Loss", name: "Critical Equipment & Data Loss", description: "Equipment damage or loss through negligence, or raw footage lost by not following the backup and file-handling process.", deduct: 10 },
    ],
    people: ["harishussain@harisand.co", "mubasshir@harisand.co"],
  },
  {
    name: "Social Media – Production Controller",
    kras: [
      { name: "Performance", points: 50, kpis: [["On-time Shoots", "% adherence"], ["Budget Variance", "Planned vs actual"], ["Utilization", "% efficiency"]] },
      { name: "Potential – Delay Reduction", points: 25, kpis: [["Delay Reduction", "Shoot delays"]] },
      { name: "Potential – Reshoot Rate", points: 25, kpis: [["Reshoot Rate", "% reshoots"]] },
    ],
    risks: [
      { category: "Decisions without approval", name: "Decisions without approval", description: "Taking decisions without senior/lead approval, or acting without prior review, approval or quality check.", deduct: 10 },
      { category: "Negative client impact", name: "Negative client impact", description: "Actions leading to negative client impact.", deduct: 10 },
    ],
    people: ["arundas@harisand.co"],
  },
  {
    name: "Social Media – Production Head",
    def: "Senior operational authority for the Social Media department's delivery: resource management, interdepartmental alignment, operational problem-solving, team stability and delivery assurance across managers, production, creators, writers and influencer teams.",
    kras: [
      { name: "Production Management", points: 25, kpis: [["Production Timeline", "Overall production schedule adherence"], ["On-time Shoots", "(Shoots completed on schedule / Planned shoots) x 100"]] },
      { name: "Efficiency", points: 23, kpis: [["Budget Adherence", "Planned budget vs actual budget"], ["Equipment Management", "Equipment damage / loss incidents"], ["Reshoot Reduction", "(Reshoots / Total shoots) x 100"]] },
      { name: "Team Performance", points: 21, kpis: [["Team KPI Achievement", "Average KPI score of production team"], ["Production Quality", "Internal quality audit score"]] },
      { name: "Leadership", points: 14, kpis: [["Team Development", "Performance improvement of team members"], ["Operational Problem Solving", "Leadership assessment"]] },
      { name: "Business Contribution", points: 17, kpis: [["Process Improvement", "New workflow / process improvements implemented"], ["Resource Utilization", "Production resource utilization %"], ["Innovation & Automation", "New production methods adopted"]] },
    ],
    risks: [
      { category: "Client Impact", name: "Client dissatisfaction / Delivery failure / Equipment failure", description: "Client complaints caused by production failures, monthly production completion below 90%, or damage/loss through negligence. One deduction for the category.", deduct: 40 },
      { category: "Risk Management", name: "Unauthorized decisions / Operational breakdown", description: "Unauthorized production decisions, or failures caused by poor supervision. One deduction for the category.", deduct: 20 },
    ],
    people: ["fairu@harisand.co"],
  },
  {
    name: "Social Media – Graphic Designer",
    kras: [
      { name: "Task Execution & Timeliness", points: 20, kpis: [["On-time task completion", "% of tasks completed before deadline (each set of 5 due tasks counts as 1 mark)"], ["Productivity", "Number of tasks completed per month (number of creatives)"], ["Error-free submissions", "% of work without rework"]] },
      { name: "Quality & Process Adherence", points: 20, kpis: [["SOP adherence", "Following defined workflows"], ["Quality stability", "Consistency in output quality across tasks"]] },
      { name: "Client & Team Support", points: 20, kpis: [["Responsiveness", "Response time to internal / client queries"], ["Client feedback", "Feedback score on work quality"], ["Team dependency", "Ability to work with minimal help"]] },
      { name: "Ownership Mindset", points: 10, kpis: [["Task ownership", "Completes tasks without follow-ups"], ["Accountability", "Takes responsibility for mistakes"], ["Initiative", "Takes extra tasks voluntarily"]] },
      { name: "Learning & Growth", points: 10, kpis: [["Skill improvement", "Learning new tools / skills"], ["Feedback implementation", "Applies feedback in next tasks"]] },
      { name: "Work Discipline & Execution Risk", points: 20, kpis: [["Delivery impact delay", "Delay affecting project timelines"], ["Unauthorized actions", "Working without approval / skipping process"], ["Professional behavior", "Poor attitude, conflicts, ignoring feedback"]] },
    ],
    risks: [UDI(20), CHURN(20), DELIV(20)],
    people: ["ansil@harisand.co", "akashm@harisand.co", "shiblu@harisand.co", "rakhil@harisand.co"],
  },
  {
    name: "Social Media – Video Editor",
    kras: [
      { name: "Delivery Ownership & Consistency", points: 16.6, kpis: [["On-time delivery", "95% of tasks/projects delivered on time (each set of 5 due tasks counts as 1 mark)"], ["End-to-end ownership", "Handles complete execution (number of creatives)"], ["Client feedback", "Satisfaction score on deliverables"]] },
      { name: "Quality Control & Review Responsibility", points: 16.6, kpis: [["Review accuracy", "Ensuring junior/executive work is error-free before submission"], ["Quality benchmark maintenance", "Maintaining consistent quality standards across outputs"], ["Rework reduction", "Minimizing repeated revisions across team output"]] },
      { name: "Team Performance & Issue Resolution", points: 16.6, kpis: [["Executive performance tracking", "Monitoring executive KPIs and output"], ["Team output contribution", "Contribution to overall team productivity"], ["Issue resolution", "Solving execution and quality issues independently"]] },
      { name: "Ownership & Leadership Readiness", points: 16.6, kpis: [["Ownership mindset", "Takes responsibility for delivery outcomes"], ["Pressure handling", "Works independently without supervision"], ["Initiative", "Identifies gaps and drives improvements"]] },
      { name: "Mentorship & Strategic Contribution", points: 16.6, kpis: [["Team development", "Upskilling juniors and executives"], ["Cross-functional coordination", "Works effectively with other teams"], ["Strategic thinking", "Suggests process improvements for efficiency"]] },
      { name: "Quality Control & Team Stability Risk", points: 17, kpis: [["Poor quality control", "Errors in reviewed/submitted work affecting final output"], ["Team dependency failure", "Failure to support juniors/executives leading to dependency overload"], ["Professional behavior", "Conflicts, ego issues, ignoring feedback"]] },
    ],
    // The PDF names these but gives no deduction values: shown, not deducted.
    risks: [UDI(null), CHURN(null), DELIV(null)],
    people: ["akshayt@harisand.co", "pranav@harisand.co"],
  },
  {
    name: "Social Media – Talent & Influencer Marketing",
    def: "Manages talent, casting and influencer marketing for client campaigns: sourcing, shortlisting and coordinating actors, models, presenters, creators and influencers, through negotiation, scheduling, shoot coordination, approvals and execution.",
    kras: [
      { name: "Performance in IM", points: 30, kpis: [["ROI", "Reach / engagement"], ["Database Growth", "Number of creators added"], ["Timely Delivery", "% on-time posts"]] },
      { name: "Potential in IM", points: 20, kpis: [["Cost Efficiency", "Cost per influencer"], ["Repeat Collabs", "% repeat creators"]] },
      { name: "Performance in Casting", points: 30, kpis: [["Turnaround Time", "Time to close casting"], ["Match Accuracy", "Director feedback"], ["Budget Control", "Talent vs budget"]] },
      { name: "Potential in Casting", points: 20, kpis: [["Availability", "Number of dropouts"], ["Talent Pool", "Active profiles count"]] },
    ],
    risks: [
      { category: "Decisions without approval", name: "Decisions without approval", description: "Taking decisions without senior/lead approval, or acting without prior review, approval or quality check.", deduct: null },
      { category: "Negative client impact", name: "Negative client impact", description: "Actions leading to negative client impact.", deduct: null },
    ],
    people: ["abhirami@harisand.co", "fadijiyad@harisand.co"],
  },
];

// Social Media people missing from Review, and Team Leads who need a login to score.
const ADD_EMPLOYEES = ["parita@harisand.co", "rakhil@harisand.co", "pranav@harisand.co"];
const LINK_BY_NAME: [reviewName: string, peopleEmail: string][] = [["Muhammed Shiblu", "shiblu@harisand.co"]];
const ADD_LOGINS = ["munawar@harisand.co", "arundas@harisand.co"];

async function prepare() {
  const emails = [...ADD_EMPLOYEES, ...LINK_BY_NAME.map((l) => l[1]), ...ADD_LOGINS];
  const ppl = await db.$queryRaw<{ id: string; name: string; email: string; designation: string | null; manager: string | null; login: string | null }[]>`
    SELECT e."id", trim(regexp_replace(e."firstName" || ' ' || e."lastName", '\\s+', ' ', 'g')) AS "name", lower(e."officialEmail") AS "email",
           d."title" AS "designation", trim(m."firstName" || ' ' || m."lastName") AS "manager", lower(u."email") AS "login"
    FROM "public"."Employee" e
    LEFT JOIN "public"."Designation" d ON d."id" = e."designationId"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId"
    LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    WHERE lower(e."officialEmail") = ANY(${emails})`;
  const by = new Map(ppl.map((p) => [p.email, p]));
  const dept = await db.department.findFirst({ where: { name: "Social Media", organization: { code: ORG } }, select: { id: true, organizationId: true } });
  if (!dept) throw new Error("No Social Media department in Review.");

  console.log("\nPreparing people:");
  for (const email of ADD_EMPLOYEES) {
    const p = by.get(email);
    if (!p) { console.log(`  ! ${email}: not in People`); continue; }
    const there = await db.employee.findFirst({ where: { OR: [{ email }, { peopleEmail: email }, { peopleEmployeeId: p.id }] }, select: { id: true } });
    if (there) { console.log(`  = ${p.name}: already a Review employee`); continue; }
    console.log(`  + add employee ${p.name} <${email}> (${p.designation ?? "-"})`);
    if (APPLY) await db.employee.create({ data: { name: p.name, email, peopleEmail: p.login ?? email, peopleEmployeeId: p.id, designation: p.designation, reportingManagerName: p.manager, organizationId: dept.organizationId, departmentId: dept.id }, select: { id: true } });
  }
  for (const [name, email] of LINK_BY_NAME) {
    const p = by.get(email);
    const e = await db.employee.findFirst({ where: { name, departmentId: dept.id }, select: { id: true, peopleEmployeeId: true } });
    if (!p || !e) { console.log(`  ! ${name}: not found to link`); continue; }
    if (e.peopleEmployeeId === p.id) { console.log(`  = ${name}: already linked`); continue; }
    // Linked to an older People record (e.g. a resigned duplicate): move to the active one, and to the work email.
    console.log(`  ~ relink ${name} to the active People record <${email}>`);
    if (APPLY) await db.employee.update({ where: { id: e.id }, data: { email, peopleEmail: p.login ?? email, peopleEmployeeId: p.id }, select: { id: true } });
  }
  for (const email of ADD_LOGINS) {
    const p = by.get(email);
    const login = p?.login;
    if (!p || !login) { console.log(`  ! ${email}: no People login`); continue; }
    if (await db.user.findFirst({ where: { email: login }, select: { id: true } })) { console.log(`  = ${p.name}: already has a Review login`); continue; }
    console.log(`  + add login for ${p.name} <${login}> (signs in with People)`);
    // select: production's User table predates reviewRoleId, so never read it back.
    if (APPLY) await db.user.create({ data: { email: login, name: p.name, role: "EMPLOYEE", passwordHash: PEOPLE_MANAGED, mustChangePassword: false }, select: { id: true } });
  }
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const existing = new Set((await db.perfTemplate.findMany({ select: { name: true } })).map((t) => t.name));

  let bad = false;
  for (const c of CARDS) {
    const total = c.kras.reduce((a, k) => a + k.points, 0);
    const n = c.kras.reduce((a, k) => a + k.kpis.length, 0);
    const ok = Math.abs(total - 100) < 1e-9 && new Set(c.kras.map((k) => k.name)).size === c.kras.length;
    if (!ok) bad = true;
    const ded = c.risks.map((r) => (r.deduct == null ? "watch" : `-${r.deduct}`)).join(" ");
    console.log(`${c.name.padEnd(50)} ${String(n).padStart(2)} KPIs / ${c.kras.length} KRAs = ${total} | critical: ${ded}${existing.has(c.name) ? "  [exists, skipped]" : ""}${ok ? "" : "  INVALID"}`);
  }
  if (bad) throw new Error("A scorecard does not total 100 or repeats a KRA name. Nothing written.");

  // Scorer: Team Lead (dotted line) in People, else the reporting manager.
  const leads = await db.$queryRaw<{ pid: string; email: string; scorerEmail: string | null; scorerName: string | null; via: string }[]>`
    SELECT e."id" AS "pid", lower(e."officialEmail") AS "email",
           lower(coalesce(tu."email", t."officialEmail", mu."email", m."officialEmail")) AS "scorerEmail",
           trim(coalesce(t."firstName" || ' ' || t."lastName", m."firstName" || ' ' || m."lastName")) AS "scorerName",
           CASE WHEN t."id" IS NOT NULL THEN 'team lead' ELSE 'reporting manager' END AS "via"
    FROM "public"."Employee" e
    JOIN "public"."Organization" o ON o."id" = e."organizationId" AND o."code" = ${ORG}
    LEFT JOIN "public"."Employee" t ON t."id" = e."dottedLineManagerId"
    LEFT JOIN "public"."User" tu ON tu."employeeId" = t."id"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId"
    LEFT JOIN "public"."User" mu ON mu."employeeId" = m."id"`;
  const leadOf = new Map(leads.map((l) => [l.email, l]));

  await prepare();

  const [employees, users, assigned] = await Promise.all([
    db.employee.findMany({ where: { organization: { code: ORG } }, select: { id: true, name: true, email: true, peopleEmail: true, peopleEmployeeId: true } }),
    db.user.findMany({ select: { id: true, email: true, name: true } }),
    db.perfAssignment.findMany({ select: { employeeId: true } }),
  ]);
  const empByEmail = new Map(employees.flatMap((e) => [[e.email.toLowerCase(), e], ...(e.peopleEmail ? [[e.peopleEmail.toLowerCase(), e]] : [])] as [string, typeof e][]));
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const has = new Set(assigned.map((a) => a.employeeId));

  console.log("\nAssignments (scorer = Team Lead, else reporting manager):");
  const plan: { employeeId: string; card: string; scorerUserId: string }[] = [];
  for (const c of CARDS) {
    for (const email of c.people) {
      const pid = leadOf.get(email)?.pid;
      const e = empByEmail.get(email) ?? employees.find((x) => pid && x.peopleEmployeeId === pid);
      if (!e) { console.log(`  ! ${email}: no Review employee with this email`); continue; }
      if (has.has(e.id)) { console.log(`  = ${e.name}: already assigned, left as is`); continue; }
      const l = leadOf.get(email);
      const scorer = l?.scorerEmail ? userByEmail.get(l.scorerEmail) : undefined;
      if (!scorer) { console.log(`  ! ${e.name}: scorer ${l?.scorerName ?? "?"} (${l?.via}) has no Review login, not assigned`); continue; }
      console.log(`  + ${e.name.padEnd(24)} → ${c.name.replace("Social Media – ", "").padEnd(36)} scored by ${scorer.name} (${l!.via})`);
      plan.push({ employeeId: e.id, card: c.name, scorerUserId: scorer.id });
    }
  }

  if (!APPLY) return console.log("\nNothing was written. Re-run with --apply.");

  const ids = new Map((await db.perfTemplate.findMany({ select: { id: true, name: true } })).map((t) => [t.name, t.id]));
  for (const c of CARDS) {
    if (existing.has(c.name)) continue;
    const t = await db.perfTemplate.create({
      data: {
        name: c.name,
        roleDefinition: c.def ?? null,
        versions: {
          create: {
            effectiveFrom: FROM,
            kras: {
              create: c.kras.map((k, ki) => ({
                name: k.name,
                sortOrder: ki,
                kpis: { create: k.kpis.map(([name, description], i) => ({ name, description, maxPoints: k.points / k.kpis.length, sortOrder: i })) },
              })),
            },
            risks: {
              create: c.risks.map((r, i) => ({ category: r.category, name: r.name, description: r.description, alertLevel: "Critical KPI", deductible: r.deduct != null, maxPenalty: r.deduct, sortOrder: i })),
            },
          },
        },
      },
    });
    ids.set(c.name, t.id);
    console.log(`  created ${c.name}`);
  }
  for (const p of plan) await db.perfAssignment.create({ data: { employeeId: p.employeeId, templateId: ids.get(p.card)!, scorerUserId: p.scorerUserId } });
  console.log(`\nDone. ${plan.length} assignments created.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
