/**
 * Refreshes Review's copy of its people from ONEVIEW People, so nobody has to
 * maintain the same person in two places.
 *
 * READ  : People's `public` tables (Employee, Designation, Organization, User)
 *         — SELECT only.
 * WRITE : the `review` schema only (refuses to run unless DIRECT_URL has
 *         ?schema=review). Never touches People.
 *
 * What it does, per Review employee (matched inside the same organization):
 *   1. by email   — Review email == People work email or login email;
 *   2. by name    — same name, if exactly ONE person fits;
 *   3. partial    — a shortened/longer name ("Rashid" ~ "Mohammed Rashid A").
 *                   Listed only; applied solely with --accept-partial.
 * and, when matched, it fills `peopleEmail` (the address they sign in with),
 * and refreshes designation and reporting manager from People.
 *
 * It deliberately does NOT change `email` (where review emails are sent),
 * `isActive` (HR's decision about who is reviewable) or anything else HR
 * decided in Review. People staff who have left are reported, not removed.
 *
 * Review users who cannot sign in because their email isn't a People login
 * are matched to the same person in People by name, and their email is
 * corrected to the People login. A match that would collide with another
 * Review user is reported for a human to merge.
 *
 *   npx tsx prisma/sync-from-people.ts                   # dry run
 *   npx tsx prisma/sync-from-people.ts --apply
 *   npx tsx prisma/sync-from-people.ts --apply --accept-partial
 *   npx tsx prisma/sync-from-people.ts --apply --deactivate-left   # retire people who left
 *   npx tsx prisma/sync-from-people.ts --apply --deactivate-missing --keep="Safva K,Navaneet"
 */
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "../src/lib/audit";
import { nameTokens } from "../src/domain/people/match";
import { find, loadPeople, reviewClient, type Match, type PeopleEmp } from "./_people";

const APPLY = process.argv.includes("--apply");
const ACCEPT_PARTIAL = process.argv.includes("--accept-partial");
const DEACTIVATE_LEFT = process.argv.includes("--deactivate-left");
// People who exist in Review but nowhere in People. Retiring them is opt-in,
// and --keep="Name,Other Name" protects anyone who should stay (e.g. someone
// not yet in People, or spelled differently there).
const DEACTIVATE_MISSING = process.argv.includes("--deactivate-missing");
// Active people in People that Review has never had. Opt-in: it makes them
// reviewable and counts them in HR's completion numbers.
const IMPORT_MISSING = process.argv.includes("--import-missing");
const keepNames = (process.argv.find((a) => a.startsWith("--keep=")) ?? "")
  .slice("--keep=".length)
  .replace(/^"|"$/g, "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const db = reviewClient();

const usable = (m: Match) => m.how !== "partial" || ACCEPT_PARTIAL;

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}${ACCEPT_PARTIAL ? " (accepting partial name matches)" : ""}${DEACTIVATE_LEFT ? " (deactivating people who left)" : ""}\n`);
  const people = await loadPeople(db);
  const byOrg = new Map<string, PeopleEmp[]>();
  for (const p of people) byOrg.set(p.orgCode, [...(byOrg.get(p.orgCode) ?? []), p]);

  // ── Employees ──────────────────────────────────────────────────────
  const employees = await db.employee.findMany({ include: { organization: { select: { code: true } } } });
  const tally = { email: 0, name: 0, partial: 0, ambiguous: 0, none: 0 };
  const partial: string[] = [];
  const ambiguous: string[] = [];
  const none: string[] = [];
  const left: string[] = [];
  const deactivations: { id: string; name: string }[] = [];
  const missing: { id: string; name: string }[] = [];
  const matchedPeople = new Set<string>();
  const updates: { id: string; name: string; data: { peopleEmail?: string | null; designation?: string; reportingManagerName?: string } }[] = [];

  for (const e of employees) {
    const out = find(e.name, e.email, byOrg.get(e.organization.code) ?? []);
    if (out.kind === "none") {
      tally.none++;
      if (e.isActive) {
        none.push(`${e.name} <${e.email}>`);
        // Only ever retired on request, and never someone on the --keep list.
        if (!keepNames.some((k) => nameTokens(k).join(" ") === nameTokens(e.name).join(" "))) {
          missing.push({ id: e.id, name: e.name });
        }
      }
      continue;
    }
    if (out.kind === "ambiguous") {
      tally.ambiguous++;
      ambiguous.push(`${e.name} <${e.email}>  could be: ${out.names.join(" | ")}`);
      continue;
    }
    const { how, person } = out.match;
    tally[how]++;
    // Counted even when a partial match isn't applied, so that person is
    // never also imported as if they were new.
    matchedPeople.add(person.id);
    if (how === "partial") partial.push(`${e.name} <${e.email}>  ->  ${person.name} <${person.loginEmail ?? person.officialEmail}>`);
    if (!usable(out.match)) continue;

    if (e.isActive && !person.active) {
      left.push(`${e.name} <${e.email}> is not active in People`);
      deactivations.push({ id: e.id, name: e.name });
    }

    const data: (typeof updates)[number]["data"] = {};
    const login = person.loginEmail;
    if (login && login !== e.email.toLowerCase() && login !== e.peopleEmail) data.peopleEmail = login;
    if (person.designation && person.designation !== e.designation) data.designation = person.designation;
    if (person.manager && person.manager !== e.reportingManagerName) data.reportingManagerName = person.manager;
    if (Object.keys(data).length > 0) updates.push({ id: e.id, name: e.name, data });
  }

  console.log("EMPLOYEES");
  console.log(`  matched by email ${tally.email}, by name ${tally.name}, partial-name ${tally.partial}, ambiguous ${tally.ambiguous}, not found ${tally.none}  (of ${employees.length})`);
  console.log(`  would update ${updates.length} (peopleEmail ${updates.filter((u) => u.data.peopleEmail).length}, designation ${updates.filter((u) => u.data.designation).length}, manager ${updates.filter((u) => u.data.reportingManagerName).length})`);
  const show = (title: string, list: string[]) => {
    if (list.length === 0) return;
    console.log(`\n  ${title} (${list.length}):`);
    for (const l of list.slice(0, 40)) console.log(`    - ${l}`);
    if (list.length > 40) console.log(`    … and ${list.length - 40} more`);
  };
  show(ACCEPT_PARTIAL ? "Partial-name matches (applied)" : "Partial-name matches — NOT applied; re-run with --accept-partial once they look right", partial);
  show("Ambiguous — more than one person fits, left alone", ambiguous);
  show(
    DEACTIVATE_MISSING
      ? `Not found in People — will be DEACTIVATED in Review${keepNames.length ? ` (kept: ${keepNames.join(", ")})` : ""}`
      : "Not found in People (active in Review) — left as they are; add --deactivate-missing [--keep=\"Name,Name\"] to retire them",
    none.filter((line) => DEACTIVATE_MISSING === false || missing.some((m) => line.startsWith(m.name + " <")))
  );
  show(
    DEACTIVATE_LEFT
      ? "No longer active in People — will be DEACTIVATED in Review (history is kept)"
      : "Still active in Review but no longer active in People — left as they are; add --deactivate-left to retire them",
    left
  );

  // ── Users ──────────────────────────────────────────────────────────
  const users = await db.user.findMany({ include: { department: { select: { organization: { select: { code: true } } } } } });
  const loginEmails = new Set(people.filter((p) => p.loginEmail && p.loginActive).map((p) => p.loginEmail!));
  const userEmails = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const userUpdates: { id: string; name: string; from: string; to: string }[] = [];
  const userNotes: string[] = [];

  for (const u of users) {
    if (!u.isActive || loginEmails.has(u.email.toLowerCase())) continue;
    const orgCode = u.department?.organization.code;
    const pool = (orgCode ? (byOrg.get(orgCode) ?? []) : people).filter((p) => p.loginEmail && p.loginActive);
    const out = find(u.name, u.email, pool);
    if (out.kind === "none") {
      userNotes.push(`${u.name} <${u.email}> [${u.role}] — no People account found`);
    } else if (out.kind === "ambiguous") {
      userNotes.push(`${u.name} <${u.email}> [${u.role}] — ambiguous: ${out.names.join(" | ")}`);
    } else if (!usable(out.match)) {
      userNotes.push(`${u.name} <${u.email}> [${u.role}] — partial match to ${out.match.person.name} <${out.match.person.loginEmail}> (needs --accept-partial)`);
    } else {
      const to = out.match.person.loginEmail!;
      const taken = userEmails.get(to);
      if (taken && taken !== u.id) {
        userNotes.push(`${u.name} <${u.email}> [${u.role}] — People login ${to} already belongs to another Review user; merge by hand`);
      } else {
        userUpdates.push({ id: u.id, name: u.name, from: u.email, to });
        userEmails.set(to, u.id);
      }
    }
  }
  console.log("\nREVIEW USERS that cannot sign in yet");
  console.log(`  would re-point ${userUpdates.length} to their People login:`);
  for (const u of userUpdates) console.log(`    - ${u.name}: ${u.from}  ->  ${u.to}`);
  show("Left alone", userNotes);

  // ── People that Review has never had ───────────────────────────────
  // Every active person in People that no Review employee matched. They are
  // brought in under the Review department of the same name (created if
  // Review doesn't have it), so Review can list everyone, not only the people
  // an earlier import happened to include. Anyone HR already retired in
  // Review is matched above and so is NOT re-added here.
  const [reviewOrgs, reviewDepts] = await Promise.all([
    db.organization.findMany({ select: { id: true, code: true } }),
    db.department.findMany({ select: { id: true, name: true, code: true, organizationId: true } }),
  ]);
  const orgIdByCode = new Map(reviewOrgs.map((o) => [o.code, o.id]));
  const takenEmails = new Set(
    employees.flatMap((e) => [e.email.toLowerCase(), e.peopleEmail?.toLowerCase()]).filter((x): x is string => !!x)
  );
  const deptKey = (organizationId: string, name: string) => `${organizationId}|${name.trim().toLowerCase()}`;
  const deptByKey = new Map(reviewDepts.map((d) => [deptKey(d.organizationId, d.name), d]));
  const codesTaken = new Set(reviewDepts.map((d) => `${d.organizationId}|${d.code.toLowerCase()}`));

  const toImport: { person: PeopleEmp; organizationId: string }[] = [];
  const newDepartments = new Map<string, { organizationId: string; name: string; code: string }>();
  const importSkipped: string[] = [];
  for (const p of people) {
    if (!p.active || matchedPeople.has(p.id)) continue;
    const organizationId = orgIdByCode.get(p.orgCode);
    if (!organizationId) {
      importSkipped.push(`${p.name} — organization ${p.orgCode} is not set up in Review`);
      continue;
    }
    if (!p.department) {
      importSkipped.push(`${p.name} <${p.officialEmail}> — has no department in People`);
      continue;
    }
    if (takenEmails.has(p.officialEmail)) {
      importSkipped.push(`${p.name} <${p.officialEmail}> — that email already belongs to another Review employee`);
      continue;
    }
    const key = deptKey(organizationId, p.department);
    if (!deptByKey.has(key) && !newDepartments.has(key)) {
      const code = (p.departmentCode ?? p.department).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!code || codesTaken.has(`${organizationId}|${code.toLowerCase()}`)) {
        importSkipped.push(`${p.name} — department "${p.department}" would clash with an existing department code (${code || "empty"})`);
        continue;
      }
      newDepartments.set(key, { organizationId, name: p.department.trim(), code });
      codesTaken.add(`${organizationId}|${code.toLowerCase()}`);
    }
    toImport.push({ person: p, organizationId });
  }

  console.log("\nPEOPLE REVIEW HAS NEVER HAD (active in People, not in Review)");
  console.log(`  ${toImport.length} to add${IMPORT_MISSING ? "" : "  — add --import-missing to bring them in"}; ${newDepartments.size} new departments`);
  const perDept = new Map<string, number>();
  for (const { person, organizationId } of toImport) {
    const label = `${person.orgCode} · ${person.department}${newDepartments.has(deptKey(organizationId, person.department!)) ? " (new)" : ""}`;
    perDept.set(label, (perDept.get(label) ?? 0) + 1);
  }
  for (const [label, n] of [...perDept].sort()) console.log(`    ${String(n).padStart(3)}  ${label}`);
  show("Skipped", importSkipped);

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply.");
    return;
  }

  // Small batches, each its own transaction with a generous timeout. One big
  // transaction timed out (Prisma's default is 5s and every row is a round
  // trip to a database in another region). Each row's change plus its audit
  // entry still land together, and because what to change is worked out from
  // the current state, a run that stops partway is simply re-run.
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

  // Users first: re-pointing the Team Leads is what unblocks the scoring tree.
  if (userUpdates.length > 0) console.log("\nRe-pointing users");
  await inBatches(userUpdates, async (tx, u) => {
    await tx.user.update({ where: { id: u.id }, data: { email: u.to, failedLoginAttempts: 0, lockedUntil: null } });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: u.id,
      action: "USER_UPDATED",
      actorUserId: null,
      actorEmail: null,
      before: { email: u.from },
      after: { email: u.to },
      metadata: { source: "people-sync", name: u.name },
    });
  });

  if (updates.length > 0) console.log("\nRefreshing employees");
  await inBatches(updates, async (tx, u) => {
    await tx.employee.update({ where: { id: u.id }, data: u.data });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: u.id,
      action: "EMPLOYEE_UPDATED",
      actorUserId: null,
      actorEmail: null,
      after: u.data,
      metadata: { source: "people-sync", name: u.name },
    });
  });

  // Retiring someone only stops them being offered for new reviews and
  // sends; their past submissions and emails stay exactly as they were.
  if (DEACTIVATE_LEFT) {
    if (deactivations.length > 0) console.log("\nRetiring people who have left");
    await inBatches(deactivations, async (tx, d) => {
      await tx.employee.update({ where: { id: d.id }, data: { isActive: false } });
      await writeAuditEvent(tx, {
        entityType: "Employee",
        entityId: d.id,
        action: "EMPLOYEE_UPDATED",
        actorUserId: null,
        actorEmail: null,
        before: { isActive: true },
        after: { isActive: false },
        metadata: { source: "people-sync", reason: "no longer active in People", name: d.name },
      });
    });
  }
  if (DEACTIVATE_MISSING) {
    if (missing.length > 0) console.log("\nRetiring people who are not in People");
    await inBatches(missing, async (tx, d) => {
      await tx.employee.update({ where: { id: d.id }, data: { isActive: false } });
      await writeAuditEvent(tx, {
        entityType: "Employee",
        entityId: d.id,
        action: "EMPLOYEE_UPDATED",
        actorUserId: null,
        actorEmail: null,
        before: { isActive: true },
        after: { isActive: false },
        metadata: { source: "people-sync", reason: "not found in People", name: d.name },
      });
    });
  }
  if (IMPORT_MISSING && toImport.length > 0) {
    const deptIds = new Map<string, string>([...deptByKey].map(([k, d]) => [k, d.id]));

    if (newDepartments.size > 0) console.log("\nCreating departments");
    await inBatches([...newDepartments], async (tx, [key, d]) => {
      const created = await tx.department.create({ data: d });
      deptIds.set(key, created.id);
      await writeAuditEvent(tx, {
        entityType: "Department",
        entityId: created.id,
        action: "DEPARTMENT_CREATED",
        actorUserId: null,
        actorEmail: null,
        after: d,
        metadata: { source: "people-sync" },
      });
    });

    console.log("\nAdding people from People");
    await inBatches(toImport, async (tx, { person, organizationId }) => {
      const data = {
        name: person.name,
        email: person.officialEmail,
        organizationId,
        departmentId: deptIds.get(deptKey(organizationId, person.department!))!,
        designation: person.designation,
        reportingManagerName: person.manager,
        peopleEmail: person.loginEmail && person.loginEmail !== person.officialEmail ? person.loginEmail : null,
        isActive: true,
      };
      const created = await tx.employee.create({ data });
      await writeAuditEvent(tx, {
        entityType: "Employee",
        entityId: created.id,
        action: "EMPLOYEE_CREATED",
        actorUserId: null,
        actorEmail: null,
        after: { name: data.name, email: data.email, departmentId: data.departmentId },
        metadata: { source: "people-sync" },
      });
    });
  }
  console.log(
    `\nApplied: ${updates.length} employees refreshed, ${(DEACTIVATE_LEFT ? deactivations.length : 0) + (DEACTIVATE_MISSING ? missing.length : 0)} deactivated, ${userUpdates.length} users re-pointed.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
