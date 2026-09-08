"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
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
  const admin = await requireAdmin();
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
  const admin = await requireAdmin();
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
      actorUserId: admin.id,
      actorEmail: admin.email,
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
  const admin = await requireAdmin();
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
  if (!existing) return fail("Employee not found.");

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
      actorUserId: admin.id,
      actorEmail: admin.email,
      before: { name: existing.name, email: existing.email, departmentId: existing.departmentId },
      after: { name: parsed.data.name, email: parsed.data.email, departmentId: department.id, additionalDepartmentIds },
    });
  });

  revalidatePath("/admin/employees");
  revalidatePath("/review");
  return ok(undefined, `Updated ${parsed.data.name}.`);
}

export async function toggleEmployeeActive(employeeId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return fail("Employee not found.");

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { isActive: !employee.isActive } });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: employeeId,
      action: "EMPLOYEE_UPDATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      before: { isActive: employee.isActive },
      after: { isActive: !employee.isActive },
    });
  });

  revalidatePath("/admin/employees");
  revalidatePath("/overview");
  return ok(undefined, employee.isActive ? "Employee deactivated." : "Employee reactivated.");
}

export async function createUser(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const clash = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (clash) return fail("A user with that email already exists.");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        departmentId: parsed.data.role === "DEPARTMENT_HEAD" ? parsed.data.departmentId : null,
        passwordHash,
        mustChangePassword: true,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: created.id,
      action: "USER_CREATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      after: { email: parsed.data.email, role: parsed.data.role },
    });
    return created;
  });

  revalidatePath("/admin/users");
  return ok(undefined, `User "${user.name}" created.`);
}

/**
 * Corrects an existing user — role, scope (department), name/email, and
 * optionally the password. Password is only touched when a non-empty
 * value is submitted; leaving it blank keeps the current one untouched.
 * A reset password forces mustChangePassword again, same as a fresh
 * account, and clears any lockout counters.
 */
export async function updateUser(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || undefined,
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const existing = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!existing) return fail("User not found.");

  // Guard against locking yourself out — same spirit as the
  // can't-deactivate-yourself check on toggleUserActive.
  if (existing.id === admin.id && parsed.data.role !== "ADMIN") {
    return fail("You cannot change your own role away from Admin.");
  }

  const clash = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: existing.id } },
  });
  if (clash) return fail("Another user already uses that email.");

  const departmentId = parsed.data.role === "DEPARTMENT_HEAD" ? (parsed.data.departmentId ?? null) : null;
  const resettingPassword = !!parsed.data.password;
  const passwordHash = resettingPassword ? await bcrypt.hash(parsed.data.password!, 10) : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        departmentId,
        ...(passwordHash
          ? { passwordHash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null }
          : {}),
      },
    });
    await writeAuditEvent(tx, {
      entityType: "User",
      entityId: existing.id,
      action: "USER_UPDATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      before: { name: existing.name, email: existing.email, role: existing.role, departmentId: existing.departmentId },
      after: { name: parsed.data.name, email: parsed.data.email, role: parsed.data.role, departmentId, passwordReset: resettingPassword },
    });
  });

  revalidatePath("/admin/users");
  return ok(undefined, `Updated ${parsed.data.name}.`);
}

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("User not found.");
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
