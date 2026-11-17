import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { norm, planSync, type PeopleRow, type SyncPlan } from "@/domain/people/sync-plan";

/**
 * Review mirrors every organization in ONEVIEW People. One that People has and
 * Review doesn't is added (same code and name), so its staff follow
 * automatically; returns the codes to sync.
 */
async function ensureOrganizations(apply: boolean): Promise<string[]> {
  const people = await prisma.$queryRaw<{ code: string; name: string }[]>`SELECT "code", "name" FROM "public"."Organization"`;
  const have = await prisma.organization.findMany({ select: { code: true, name: true } });
  const codes = new Set(have.map((o) => o.code));
  const names = new Set(have.map((o) => o.name.toLowerCase()));
  for (const o of people) {
    if (codes.has(o.code) || !apply) continue;
    const name = names.has(o.name.toLowerCase()) ? `${o.name} (${o.code})` : o.name;
    await prisma.organization.create({ data: { id: `org_${o.code.toLowerCase()}`, code: o.code, name }, select: { id: true } });
  }
  return people.map((o) => o.code);
}

/** People records that are system accounts, not employees; never brought into Review. */
const NOT_EMPLOYEES = new Set(["system administrator"]);

interface PeopleSql {
  id: string;
  firstName: string;
  lastName: string;
  officialEmail: string;
  status: string;
  archivedAt: Date | null;
  orgCode: string;
  department: string | null;
  departmentCode: string | null;
  designation: string | null;
  mgrFirst: string | null;
  mgrLast: string | null;
  loginEmail: string | null;
}

/** Read-only: ONEVIEW People's employees, from its `public` tables. */
async function loadPeopleRows(SYNC_ORGS: string[]): Promise<PeopleRow[]> {
  const rows = await prisma.$queryRaw<PeopleSql[]>`
    SELECT e."id", e."firstName", e."lastName", lower(e."officialEmail") AS "officialEmail",
           e."employmentStatus"::text AS "status", e."archivedAt", o."code" AS "orgCode",
           dep."name" AS "department", dep."code" AS "departmentCode", d."title" AS "designation",
           m."firstName" AS "mgrFirst", m."lastName" AS "mgrLast", lower(u."email") AS "loginEmail"
    FROM "public"."Employee" e
    JOIN "public"."Organization" o ON o."id" = e."organizationId"
    LEFT JOIN "public"."Department" dep ON dep."id" = e."departmentId"
    LEFT JOIN "public"."Designation" d ON d."id" = e."designationId"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId"
    LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
    WHERE o."code" = ANY(${SYNC_ORGS}::text[])
  `;
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.replace(/\s+/g, " ").trim(),
    officialEmail: r.officialEmail,
    loginEmail: r.loginEmail,
    orgCode: r.orgCode,
    department: r.department,
    departmentCode: r.departmentCode,
    designation: r.designation,
    manager: r.mgrFirst ? `${r.mgrFirst} ${r.mgrLast ?? ""}`.trim() : null,
    active: r.status === "ACTIVE" && !r.archivedAt,
  })).filter((p) => !NOT_EMPLOYEES.has(p.name.toLowerCase()));
}

export interface SyncSummary {
  applied: boolean;
  created: number;
  activated: number;
  deactivated: number;
  updated: number;
  newDepartments: number;
  skipped: string[];
  /** Names, for the first few of each, so a report can say who. */
  who: { created: string[]; activated: string[]; deactivated: string[] };
}

const BATCH = 15;
async function inBatches<T>(items: T[], run: (tx: Prisma.TransactionClient, item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += BATCH) {
    await prisma.$transaction(
      async (tx) => {
        for (const item of items.slice(i, i + BATCH)) await run(tx, item);
      },
      { maxWait: 20_000, timeout: 90_000 }
    );
  }
}

/**
 * Brings Review's people in line with ONEVIEW People: active in People means
 * active here, new people appear, everyone else is marked inactive. Names and
 * departments of existing people are never touched — Review keeps its own
 * review structure (e.g. Design School, SHO) — and nothing is ever deleted,
 * so history stays intact.
 *
 * Safe to run repeatedly; a second run finds nothing to do.
 */
export async function runPeopleSync(options: { apply: boolean; actor: { id: string; email: string } | null }): Promise<SyncSummary & { plan: SyncPlan }> {
  const SYNC_ORGS = await ensureOrganizations(options.apply);
  const [people, employees, departments, orgs] = await Promise.all([
    loadPeopleRows(SYNC_ORGS),
    prisma.employee.findMany({
      where: { organization: { code: { in: SYNC_ORGS } } },
      include: { organization: { select: { code: true } }, department: { select: { name: true } } },
    }),
    prisma.department.findMany({ where: { organization: { code: { in: SYNC_ORGS } } }, include: { organization: { select: { code: true } } } }),
    prisma.organization.findMany({ where: { code: { in: SYNC_ORGS } }, select: { id: true, code: true } }),
  ]);

  const plan = planSync({
    scope: SYNC_ORGS,
    people,
    review: employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      peopleEmail: e.peopleEmail,
      peopleEmployeeId: e.peopleEmployeeId,
      orgCode: e.organization.code,
      departmentName: e.department.name,
      designation: e.designation,
      reportingManagerName: e.reportingManagerName,
      isActive: e.isActive,
    })),
    departments: departments.map((d) => ({ id: d.id, name: d.name, code: d.code, orgCode: d.organization.code })),
  });

  const summary: SyncSummary = {
    applied: options.apply,
    created: plan.create.length,
    activated: plan.activate.length,
    deactivated: plan.deactivate.length,
    updated: plan.update.length,
    newDepartments: plan.newDepartments.length,
    skipped: plan.skipped,
    who: {
      created: plan.create.map((c) => c.person.name),
      activated: plan.activate.map((id) => employees.find((e) => e.id === id)?.name ?? id),
      deactivated: plan.deactivate.map((d) => d.name),
    },
  };
  if (!options.apply) return { ...summary, plan };

  const orgId = new Map(orgs.map((o) => [o.code, o.id]));
  const deptId = new Map(departments.map((d) => [`${d.organization.code}|${norm(d.name)}`, d.id]));
  const actor = { actorUserId: options.actor?.id ?? null, actorEmail: options.actor?.email ?? null };
  const meta = { source: "people-sync", trigger: options.actor ? "manual" : "scheduled" };

  await inBatches(plan.newDepartments, async (tx, d) => {
    const created = await tx.department.create({ data: { organizationId: orgId.get(d.orgCode)!, name: d.name, code: d.code } });
    deptId.set(d.key, created.id);
    await writeAuditEvent(tx, { entityType: "Department", entityId: created.id, action: "DEPARTMENT_CREATED", ...actor, after: { name: d.name }, metadata: meta });
  });

  await inBatches(plan.create, async (tx, { person: p, departmentKey }) => {
    const created = await tx.employee.create({
      data: {
        name: p.name,
        email: p.officialEmail,
        organizationId: orgId.get(p.orgCode)!,
        departmentId: deptId.get(departmentKey)!,
        designation: p.designation,
        reportingManagerName: p.manager,
        peopleEmail: p.loginEmail && p.loginEmail !== p.officialEmail ? p.loginEmail : null,
        peopleEmployeeId: p.id,
        isActive: true,
      },
    });
    await writeAuditEvent(tx, { entityType: "Employee", entityId: created.id, action: "EMPLOYEE_CREATED", ...actor, after: { name: p.name, email: p.officialEmail }, metadata: meta });
  });

  await inBatches(plan.update, async (tx, u) => {
    const move = u.moveToDepartmentKey ? deptId.get(u.moveToDepartmentKey) : undefined;
    await tx.employee.update({
      where: { id: u.id },
      data: { ...u.data, ...(move ? { departmentId: move } : {}), ...(u.moveToOrgCode && move ? { organizationId: orgId.get(u.moveToOrgCode)! } : {}) },
    });
    // Joiners, returners and leavers are worth a line of their own; routine
    // detail changes are covered by the run's summary.
    if (u.data.isActive !== undefined) {
      await writeAuditEvent(tx, {
        entityType: "Employee",
        entityId: u.id,
        action: "EMPLOYEE_UPDATED",
        ...actor,
        before: { isActive: !u.data.isActive },
        after: { isActive: u.data.isActive },
        metadata: { ...meta, name: u.name, reason: u.what.join(", ") },
      });
    }
  });

  // Anyone who isn't in People at all (so there was nothing to update).
  const alreadyHandled = new Set(plan.update.map((u) => u.id));
  await inBatches(plan.deactivate.filter((d) => !alreadyHandled.has(d.id)), async (tx, d) => {
    await tx.employee.update({ where: { id: d.id }, data: { isActive: false } });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: d.id,
      action: "EMPLOYEE_UPDATED",
      ...actor,
      before: { isActive: true },
      after: { isActive: false },
      metadata: { ...meta, name: d.name, reason: d.why },
    });
  });

  await writeAuditEvent(prisma, {
    entityType: "PeopleSync",
    entityId: "people",
    action: "PEOPLE_SYNCED",
    ...actor,
    metadata: {
      ...meta,
      created: summary.created,
      activated: summary.activated,
      deactivated: summary.deactivated,
      updated: summary.updated,
      newDepartments: summary.newDepartments,
      skipped: summary.skipped.length,
    },
  });
  return { ...summary, plan };
}
