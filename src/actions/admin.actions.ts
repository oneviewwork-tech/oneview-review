"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { mayGrant } from "@/domain/roles";
import { systemRoleFor } from "@/lib/permissions";
import { findPeopleIdentity, PEOPLE_MANAGED } from "@/services/people/identity";
import { prisma } from "@/lib/prisma";
import { requirePermission, type AccessProfile } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import {
  createDepartmentSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createUserSchema,
  updateUserSchema,
} from "@/validators/admin";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export async function createDepartment(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { user: admin } = await requirePermission("DEPARTMENTS_MANAGE");
  const parsed = createDepartmentSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  // Uniqueness is per organization: both entities may run their own
  // "Marketing", and that is not a clash.
  const clash = await prisma.department.findFirst({
    where: {
      organizationId: parsed.data.organizationId,
      OR: [{ name: parsed.data.name }, { code: parsed.data.code }],
    },
  });
  if (clash) return fail("That organization already has a department with this name or code.");

  const dept = await prisma.$transaction(async (tx) => {
    const created = await tx.department.create({ data: parsed.data });
    await writeAuditEvent(tx, {
      entityType: "Department",
      entityId: created.id,
      action: "DEPARTMENT_CREATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      after: parsed.data,
    });
    return created;
  });

  revalidatePath("/admin/departments");
  return ok(undefined, `Department "${dept.name}" created.`);
}

/**
 * Narrows a requested list of additional-department ids down to ones that
 * are actually safe to link: real departments, in the same organization as
 * the employee's home department, and not the home department itself
 * (that would just duplicate what departmentId already means).
 */
async function resolveAdditionalDepartmentIds(
  requestedIds: string[],
  organizationId: string,
  homeDepartmentId: string
): Promise<string[]> {
  if (requestedIds.length === 0) return [];
  const valid = await prisma.department.findMany({
    where: { id: { in: requestedIds }, organizationId, NOT: { id: homeDepartmentId } },
    select: { id: true },
  });
  return valid.map((d) => d.id);
}

export async function createEmployee(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { user: actor, organizationId: pinnedOrg } = await requirePermission("EMPLOYEES_MANAGE");
  const parsed = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    departmentId: formData.get("departmentId"),
    designation: formData.get("designation"),
    additionalDepartmentIds: formData.getAll("additionalDepartmentIds"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const clash = await prisma.employee.findUnique({ where: { email: parsed.data.email } });
  if (clash) return fail("An employee with that email already exists.");

  // The organization comes from the chosen department, never from the
  // request — the two can't drift out of agreement that way.
  const department = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } });
  if (!department) return fail("That department no longer exists.");
  // A role limited to one organization manages only that organization's people.
  if (pinnedOrg && department.organizationId !== pinnedOrg) return fail("You can only add people to your own organization.");

  const additionalDepartmentIds = await resolveAdditionalDepartmentIds(
    parsed.data.additionalDepartmentIds,
    department.organizationId,
    department.id
  );

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        departmentId: department.id,
        organizationId: department.organizationId,
        designation: parsed.data.designation || null,
        additionalDepartments: { create: additionalDepartmentIds.map((departmentId) => ({ departmentId })) },
      },
    });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: created.id,
      action: "EMPLOYEE_CREATED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { ...parsed.data, additionalDepartmentIds },
    });
    return created;
  });

  revalidatePath("/admin/employees");
  revalidatePath("/overview");
  return ok(undefined, `Employee "${employee.name}" added.`);
}

/**
 * Corrects an existing employee — most often a wrong email address, which
 * matters because the email is where the review actually gets delivered.
 *
 * Past submissions deliberately keep the name/email they were created with
 * (see the snapshot fields on FeedbackSubmission): fixing a typo today must
 * not rewrite what was already sent last month.
 */
export async function updateEmployee(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const { user: actor, organizationId: pinnedOrg } = await requirePermission("EMPLOYEES_MANAGE");
  const parsed = updateEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
    name: formData.get("name"),
    email: formData.get("email"),
    departmentId: formData.get("departmentId"),
    designation: formData.get("designation"),
    additionalDepartmentIds: formData.getAll("additionalDepartmentIds"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const existing = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId } });
  // A role limited to one organization manages only that organization's people.
  if (!existing || (pinnedOrg && existing.organizationId !== pinnedOrg)) return fail("Employee not found.");

  const clash = await prisma.employee.findFirst({
    where: { email: parsed.data.email, NOT: { id: existing.id } },
  });
  if (clash) return fail("Another employee already uses that email.");

  const department = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } });
  if (!department) return fail("That department no longer exists.");

  const additionalDepartmentIds = await resolveAdditionalDepartmentIds(
    parsed.data.additionalDepartmentIds,
    department.organizationId,
    department.id
  );

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        departmentId: department.id,
        organizationId: department.organizationId,
        designation: parsed.data.designation || null,
        // Fully replaced rather than diffed — the incoming list is already
        // the complete desired set, and there are never more than a
        // handful of these per employee.
        additionalDepartments: {
          deleteMany: {},
          create: additionalDepartmentIds.map((departmentId) => ({ departmentId })),
        },
      },
    });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: existing.id,
      action: "EMPLOYEE_UPDATED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: { name: existing.name, email: existing.email, departmentId: existing.departmentId },
      after: { name: parsed.data.name, email: parsed.data.email, departmentId: department.id, additionalDepartmentIds },
    });
  });

  revalidatePath("/admin/employees");
  revalidatePath("/review");
  return ok(undefined, `Updated ${parsed.data.name}.`);
}

export async function toggleEmployeeActive(employeeId: string): Promise<ActionResult> {
  const { user: actor, organizationId: pinnedOrg } = await requirePermission("EMPLOYEES_MANAGE");
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  // A role limited to one organization manages only that organization's people.
  if (!employee || (pinnedOrg && employee.organizationId !== pinnedOrg)) return fail("Employee not found.");

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { isActive: !employee.isActive } });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: employeeId,
      action: "EMPLOYEE_UPDATED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: { isActive: employee.isActive },
      after: { isActive: !employee.isActive },
    });
  });

  revalidatePath("/admin/employees");
  revalidatePath("/overview");
  return ok(undefined, employee.isActive ? "Employee deactivated." : "Employee reactivated.");
}

/**
 * Users are given a role from Users & Roles. Nobody hands out a role that
 * grants more than they have themselves, or reaches outside their own
 * organization (mayGrant); nobody changes their own role or deactivates
 * themselves.
 */
async function loadGrantableRole(profile: AccessProfile, roleId: string) {
  const role = await prisma.reviewRole.findUnique({ where: { id: roleId } });
  if (!role) return { error: "That role no longer exists." } as const;
  if (!mayGrant(profile, role)) return { error: "You can't give a role with more access than your own." } as const;
  return { role } as const;
}

/** May this actor manage this existing account at all (i.e. could they have given it its current role)? */
async function mayManage(profile: AccessProfile, user: { reviewRoleId: string | null; role: UserRole }) {
  const current = user.reviewRoleId ? await prisma.reviewRole.findUnique({ where: { id: user.reviewRoleId } }) : null;
  const fallback = systemRoleFor(user.role);
  return mayGrant(profile, current ?? { isSuperAdmin: fallback.isSuperAdmin, permissions: fallback.permissions, homeOrganizationId: null });
}

export async function createUser(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const profile = await requirePermission("USERS_MANAGE");
  const admin = profile.user;
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    departmentId: formData.get("departmentId") || undefined,
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  const granted = await loadGrantableRole(profile, parsed.data.roleId);
  if ("error" in granted) return fail(granted.error ?? "Not allowed.");
  const { role } = granted;
  if (role.baseRole === "DEPARTMENT_HEAD" && !parsed.data.departmentId) {
    return fail("Select the department this Team Lead submits feedback for.", { departmentId: ["Required for a Team Lead role."] });
  }

  const clash = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (clash) return fail("A user with that email already exists.");

  // Sign-in is People's: this only grants Review duties to someone who can
  // already sign in there, so the email has to be a real, active People
  // account. The name is taken from People, not from the form.
  const identity = await findPeopleIdentity(parsed.data.email);
  if (!identity || !identity.isActive) {
    return fail("No active ONEVIEW People account uses that email.", { email: ["Not found in People."] });
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: identity.name,
        email: parsed.data.email,
        role: role.baseRole,
        reviewRoleId: role.id,
        departmentId: role.baseRole === "DEPARTMENT_HEAD" ? parsed.data.departmentId : null,
        passwordHash: PEOPLE_MANAGED,
        mustChangePassword: false,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: created.id,
      action: "USER_CREATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      after: { email: parsed.data.email, role: role.name },
    });
    return created;
  });

  revalidatePath("/admin/users");
  return ok(undefined, `${user.name} added as ${role.name}.`);
}

/**
 * Corrects an existing user — role, scope (department), name/email. There
 * is no password to change here: credentials live in ONEVIEW People. Saving
 * also clears any lockout, which is how an Admin unlocks someone.
 */
export async function updateUser(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const profile = await requirePermission("USERS_MANAGE");
  const admin = profile.user;
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    departmentId: formData.get("departmentId") || undefined,
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const existing = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!existing) return fail("User not found.");
  if (!(await mayManage(profile, existing))) return fail("This account has more access than yours; only someone above it can change it.");

  const granted = await loadGrantableRole(profile, parsed.data.roleId);
  if ("error" in granted) return fail(granted.error ?? "Not allowed.");
  const { role } = granted;

  // Nobody changes their own role: it would let someone lock themselves out,
  // or promote themselves.
  if (existing.id === admin.id && role.id !== existing.reviewRoleId) return fail("You cannot change your own role.");
  if (role.baseRole === "DEPARTMENT_HEAD" && !parsed.data.departmentId) {
    return fail("Select the department this Team Lead submits feedback for.", { departmentId: ["Required for a Team Lead role."] });
  }

  const clash = await prisma.user.findFirst({ where: { email: parsed.data.email, NOT: { id: existing.id } } });
  if (clash) return fail("Another user already uses that email.");

  const departmentId = role.baseRole === "DEPARTMENT_HEAD" ? (parsed.data.departmentId ?? null) : null;
  // The email is what ties this row to the person's People account, so a
  // changed one must point at another real People account.
  if (parsed.data.email !== existing.email && !(await findPeopleIdentity(parsed.data.email))) {
    return fail("No ONEVIEW People account uses that email.", { email: ["Not found in People."] });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: role.baseRole,
        reviewRoleId: role.id,
        departmentId,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: existing.id,
      action: "USER_UPDATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      before: { name: existing.name, email: existing.email, roleId: existing.reviewRoleId, departmentId: existing.departmentId },
      after: { name: parsed.data.name, email: parsed.data.email, roleId: role.id, role: role.name, departmentId },
    });
  });

  revalidatePath("/admin/users");
  return ok(undefined, `Updated ${parsed.data.name}.`);
}

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  const profile = await requirePermission("USERS_MANAGE");
  const admin = profile.user;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("User not found.");
  if (!(await mayManage(profile, user))) return fail("This account has more access than yours; only someone above it can change it.");
  if (user.id === admin.id) return fail("You cannot deactivate your own account.");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: userId,
      action: "USER_UPDATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      before: { isActive: user.isActive },
      after: { isActive: !user.isActive },
    });
  });

  revalidatePath("/admin/users");
  return ok(undefined, user.isActive ? "User deactivated." : "User reactivated.");
}
