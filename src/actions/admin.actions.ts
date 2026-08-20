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

export async function createEmployee(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    departmentId: formData.get("departmentId"),
    designation: formData.get("designation"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const clash = await prisma.employee.findUnique({ where: { email: parsed.data.email } });
  if (clash) return fail("An employee with that email already exists.");

  // The organization comes from the chosen department, never from the
  // request — the two can't drift out of agreement that way.
  const department = await prisma.department.findUnique({ where: { id: parsed.data.departmentId } });
  if (!department) return fail("That department no longer exists.");

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        departmentId: department.id,
        organizationId: department.organizationId,
        designation: parsed.data.designation || null,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: created.id,
      action: "EMPLOYEE_CREATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      after: parsed.data,
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

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        departmentId: department.id,
        organizationId: department.organizationId,
        designation: parsed.data.designation || null,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "Employee",
      entityId: existing.id,
      action: "EMPLOYEE_UPDATED",
      actorUserId: admin.id,
      actorEmail: admin.email,
      before: { name: existing.name, email: existing.email, departmentId: existing.departmentId },
      after: { name: parsed.data.name, email: parsed.data.email, departmentId: department.id },
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
