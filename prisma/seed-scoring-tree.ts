/**
 * Proposes — and with --apply creates — the HACA scoring tree:
 *
 *   Ibrahim Saheel (Head of Academics)
 *     ├─ scores the Academic Leads: Neha Prakash (Tech), Mohammed Rashid A (Design)
 *     └─ scores Marketing mentors directly (Marketing has no lead yet)
 *   Neha Prakash   scores the Tech mentors
 *   Mohammed Rashid A scores the Design mentors
 *   Monisha M (S.SHO) scores every SHO, SEM and the Internship Coordinator
 *
 * Who falls under which lead comes from each person's designation in People
 * (src/domain/performance/roster.ts). Anything that doesn't clearly fit is
 * listed, never guessed.
 *
 * Dry run by default. Writes only to the `review` schema:
 *   - a Review user row for each scorer who doesn't have one yet (exactly what
 *     their first sign-in would have created — no password);
 *   - assignments. An existing assignment is never overwritten.
 *
 * Run `sync-from-people --apply --accept-partial` FIRST: it re-points Review's
 * old Team Lead rows (e.g. Rashid) to their People login, so this script
 * finds them instead of creating a second row.
 *
 *   npx tsx prisma/seed-scoring-tree.ts
 *   npx tsx prisma/seed-scoring-tree.ts --apply
 */
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { PEOPLE_MANAGED, initialReviewRole } from "../src/lib/people-managed";
import { matchByName } from "../src/domain/people/match";
import { classify } from "../src/domain/performance/roster";
import { loadPeople, reviewClient, type PeopleEmp } from "./_people";

const APPLY = process.argv.includes("--apply");
const ORG = "HACA";

const HEAD = "Ibrahim Saheel";
const TECH_LEAD = "Neha Prakash";
const DESIGN_LEAD = "Mohammed Rashid A";
const S_SHO = "Monisha M";

const db = reviewClient();

interface Plan {
  subject: PeopleEmp;
  template: string;
  scorer: PeopleEmp;
  why: string;
}

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const everyone = (await loadPeople(db)).filter((p) => p.orgCode === ORG && p.active);

  const must = (name: string): PeopleEmp => {
    const r = matchByName(name, everyone);
    if (r.kind !== "exact") throw new Error(`Expected exactly one "${name}" in People (${ORG}), got ${r.kind}.`);
    if (!r.match.loginEmail || !r.match.loginActive) throw new Error(`${name} has no active People login, so can't score anyone.`);
    return r.match;
  };
  const head = must(HEAD);
  const techLead = must(TECH_LEAD);
  const designLead = must(DESIGN_LEAD);
  const sSho = must(S_SHO);
  const leadIds = new Set([head.id, techLead.id, designLead.id, sSho.id]);

  const plans: Plan[] = [
    { subject: techLead, template: "Academic Lead", scorer: head, why: "Tech Lead" },
    { subject: designLead, template: "Academic Lead", scorer: head, why: "Design Lead" },
  ];
  const unclassified: string[] = [];
  for (const p of everyone) {
    if (leadIds.has(p.id)) continue;
    const c = classify(p.designation);
    if (!c) {
      if (/mentor|faculty|trainer|program lead|coordinator|officer|manager|lead/i.test(p.designation ?? "")) {
        unclassified.push(`${p.name} — ${p.designation}`);
      }
      continue;
    }
    if (c.template === "Mentor") {
      const scorer = c.track === "TECH" ? techLead : c.track === "DESIGN" ? designLead : head;
      plans.push({ subject: p, template: "Mentor", scorer, why: `${c.track} mentor` });
    } else {
      plans.push({ subject: p, template: c.template, scorer: sSho, why: c.template });
    }
  }

  // ── Resolve against Review's own records ───────────────────────────
  const [reviewEmployees, reviewUsers, templates, assignments] = await Promise.all([
    db.employee.findMany({ where: { organization: { code: ORG } }, select: { id: true, name: true, email: true, peopleEmail: true } }),
    db.user.findMany({ select: { id: true, name: true, email: true } }),
    db.perfTemplate.findMany({ select: { id: true, name: true } }),
    db.perfAssignment.findMany({ select: { employeeId: true, templateId: true, scorerUserId: true } }),
  ]);
  const templateId = new Map(templates.map((t) => [t.name, t.id]));
  for (const t of new Set(plans.map((p) => p.template))) {
    if (!templateId.has(t)) throw new Error(`No "${t}" scorecard. Run: npm run db:seed-performance`);
  }

  const employeeFor = (p: PeopleEmp) => {
    const emails = new Set([p.officialEmail, p.loginEmail].filter(Boolean) as string[]);
    const byEmail = reviewEmployees.find((e) => emails.has(e.email.toLowerCase()) || (e.peopleEmail && emails.has(e.peopleEmail.toLowerCase())));
    if (byEmail) return byEmail;
    const r = matchByName(p.name, reviewEmployees);
    return r.kind === "exact" ? r.match : null;
  };
  const userByEmail = new Map(reviewUsers.map((u) => [u.email.toLowerCase(), u]));

  // Scorers: need a Review user. Refuse to create a duplicate of someone
  // who already has a row under an old email.
  const scorers = [...new Set(plans.map((p) => p.scorer))];
  const toCreate: PeopleEmp[] = [];
  for (const s of scorers) {
    if (userByEmail.has(s.loginEmail!)) continue;
    const dup = matchByName(s.name, reviewUsers);
    if (dup.kind === "exact" || dup.kind === "partial") {
      throw new Error(
        `${s.name} already has a Review user under a different email (${dup.match.email}). ` +
          `Run: npm run db:sync-from-people -- --apply --accept-partial   — then re-run this.`
      );
    }
    toCreate.push(s);
  }

  const existing = new Map(assignments.map((a) => [a.employeeId, a]));
  const missing: string[] = [];
  const conflicts: string[] = [];
  const creates: { employeeId: string; template: string; scorer: PeopleEmp; subject: PeopleEmp }[] = [];
  let already = 0;
  for (const p of plans) {
    const emp = employeeFor(p.subject);
    if (!emp) {
      missing.push(`${p.subject.name} (${p.why}) — not in Review's employee list`);
      continue;
    }
    const cur = existing.get(emp.id);
    if (cur) {
      const sameScorer = userByEmail.get(p.scorer.loginEmail!)?.id === cur.scorerUserId;
      if (cur.templateId === templateId.get(p.template) && sameScorer) already++;
      else conflicts.push(`${p.subject.name} already has a different assignment — left as is`);
      continue;
    }
    creates.push({ employeeId: emp.id, template: p.template, scorer: p.scorer, subject: p.subject });
  }

  // ── Report ─────────────────────────────────────────────────────────
  console.log(`Review users to create for scorers: ${toCreate.length ? toCreate.map((s) => `${s.name} <${s.loginEmail}>`).join(", ") : "none"}`);
  console.log(`\nAssignments: ${creates.length} to create, ${already} already in place\n`);
  for (const s of scorers) {
    const mine = creates.filter((c) => c.scorer.id === s.id);
    const byTemplate = new Map<string, string[]>();
    for (const c of mine) byTemplate.set(c.template, [...(byTemplate.get(c.template) ?? []), c.subject.name]);
    console.log(`${s.name} scores ${mine.length}:`);
    for (const [t, names] of byTemplate) console.log(`   ${t} (${names.length}): ${names.join(", ")}`);
  }
  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    console.log(`\n${title} (${items.length}):`);
    for (const i of items) console.log(`   - ${i}`);
  };
  list("People in Review's list missing — add them under Admin → Employees (or tell me and I'll extend the sync)", missing);
  list("Roles that look like they'd be scored but have no scorecard yet — left alone", unclassified);
  list("Conflicts", conflicts);

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply.");
    return;
  }

  // Role for new scorers, read from People's own role flags.
  const flags = await db.$queryRaw<{ email: string; isSuperAdmin: boolean; isStaffTier: boolean }[]>`
    SELECT lower(u."email") AS email, r."isSuperAdmin", r."isStaffTier"
    FROM "public"."User" u JOIN "public"."Role" r ON r."id" = u."roleId"`;
  const flagFor = new Map(flags.map((f) => [f.email, f]));

  // Small batches, each its own transaction with a generous timeout: one big
  // one exceeds Prisma's 5s default when every row is a round trip to a
  // database in another region. Re-running is safe — whatever already exists
  // is skipped when the plan is worked out above.
  const BATCH = 15;
  async function inBatches<T>(items: T[], apply: (tx: Prisma.TransactionClient, item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += BATCH) {
      const slice = items.slice(i, i + BATCH);
      await db.$transaction(
        async (tx) => {
          for (const item of slice) await apply(tx, item);
        },
        { maxWait: 20_000, timeout: 90_000 }
      );
      console.log(`  …${Math.min(i + BATCH, items.length)} / ${items.length}`);
    }
  }

  await inBatches(toCreate, async (tx, s) => {
    const role = initialReviewRole(flagFor.get(s.loginEmail!) ?? { isSuperAdmin: false, isStaffTier: false });
    const u = await tx.user.create({
      data: { email: s.loginEmail!, name: s.name, role, passwordHash: PEOPLE_MANAGED, mustChangePassword: false },
    });
    userByEmail.set(u.email, u);
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: u.id,
      action: "USER_CREATED",
      actorUserId: null,
      actorEmail: null,
      after: { email: u.email, role },
      metadata: { source: "scoring-tree", name: s.name },
    });
  });

  if (creates.length > 0) console.log("Creating assignments");
  await inBatches(creates, async (tx, c) => {
    const scorerUserId = userByEmail.get(c.scorer.loginEmail!)!.id;
    await tx.perfAssignment.create({ data: { employeeId: c.employeeId, templateId: templateId.get(c.template)!, scorerUserId } });
    await writeAuditEvent(tx, {
      entityType: "PerfAssignment",
      entityId: c.employeeId,
      action: "PERF_ASSIGNMENT_SAVED",
      actorUserId: null,
      actorEmail: null,
      after: { templateId: templateId.get(c.template), scorerUserId },
      metadata: { source: "scoring-tree", employeeName: c.subject.name, scorerName: c.scorer.name },
    });
  });
  console.log(`\nCreated ${toCreate.length} users and ${creates.length} assignments.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
