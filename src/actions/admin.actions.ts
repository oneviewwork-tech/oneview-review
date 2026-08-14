"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { createDepartmentSchema, createEmployeeSchema, createUserSchema } from "@/validators/admin";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export async function createDepartment(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = createDepartmentSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const clash = await prisma.department.findFirst({
    where: { OR: [{ name: parsed.data.name }, { code: parsed.data.code }] },
  });
  if (clash) return fail("A department with that name or code already exists.");

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
  });
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);

  const clash = await prisma.employee.findUnique({ where: { email: parsed.data.email } });
  if (clash) return fail("An employee with that email already exists.");

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({ data: parsed.data });
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
