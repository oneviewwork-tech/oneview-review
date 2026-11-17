"use server";

import { revalidatePath } from "next/cache";
import type { ReviewPermission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { mayGrant, ungrantable } from "@/domain/roles";
import { PERMISSION_LABEL } from "@/lib/permissions";
import { roleSchema } from "@/validators/admin";

/**
 * Roles: create, edit, duplicate, delete. Needs "Manage roles". The same
 * no-escalation rule as handing roles out applies — a role can't be given a
 * permission the editor lacks, nor reach outside the editor's organization —
 * and the built-in roles keep their names and can't be deleted. The Admin
 * role can't be edited at all: it always has everything.
 */
function parse(input: unknown) {
  return roleSchema.safeParse(input);
}

export async function saveRole(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requirePermission("ROLES_MANAGE");
  const parsed = parse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const permissions = [...new Set(d.permissions)] as ReviewPermission[];
  const homeOrganizationId = d.homeOrganizationId || null;

  const missing = ungrantable(profile, permissions);
  if (missing.length) return fail(`You can't grant permissions you don't have: ${missing.map((p) => PERMISSION_LABEL[p]).join(", ")}.`);
  if (d.baseRole === "ADMIN" && !profile.isSuperAdmin) return fail("Only an Admin can create Admin-type roles.");
  if (profile.organizationId && homeOrganizationId !== profile.organizationId) {
    return fail("Your own role is limited to one organization, so any role you make must be limited to it too.");
  }

  const clash = await prisma.reviewRole.findFirst({ where: { name: { equals: d.name, mode: "insensitive" }, ...(d.roleId ? { NOT: { id: d.roleId } } : {}) } });
  if (clash) return fail("Another role already has that name.", { name: ["Name taken."] });

  if (d.roleId) {
    const existing = await prisma.reviewRole.findUnique({ where: { id: d.roleId } });
    if (!existing) return fail("That role no longer exists.");
    if (existing.isSuperAdmin) return fail("The Admin role always has every permission and can't be edited.");
    if (!mayGrant(profile, existing)) return fail("This role has more access than yours; you can't edit it.");
    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.reviewRole.update({
        where: { id: existing.id },
        data: {
          // Built-in roles keep their name and kind: code and the migration rely on them.
          name: existing.isSystem ? existing.name : d.name,
          baseRole: existing.isSystem ? existing.baseRole : d.baseRole,
          description: d.description || null,
          permissions,
          homeOrganizationId,
        },
      });
      // Everyone on this role follows its kind (it decides the screens they get).
      if (!existing.isSystem && existing.baseRole !== d.baseRole) {
        await tx.user.updateMany({ where: { reviewRoleId: existing.id }, data: { role: d.baseRole } });
      }
      await writeAuditEvent(tx, {
        entityType: "ReviewRole",
        entityId: existing.id,
        action: "USER_UPDATED",
        actorUserId: profile.user.id,
        actorEmail: profile.user.email,
        before: { name: existing.name, permissions: existing.permissions, homeOrganizationId: existing.homeOrganizationId },
        after: { name: updated.name, permissions, homeOrganizationId },
        metadata: { kind: "role-updated" },
      });
      return updated;
    });
    revalidatePath("/admin/users");
    return ok({ id: role.id }, `Saved "${role.name}".`);
  }

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.reviewRole.create({
      data: { name: d.name, description: d.description || null, baseRole: d.baseRole, permissions, homeOrganizationId },
    });
    await writeAuditEvent(tx, {
      entityType: "ReviewRole",
      entityId: created.id,
      action: "USER_CREATED",
      actorUserId: profile.user.id,
      actorEmail: profile.user.email,
      after: { name: created.name, permissions, homeOrganizationId },
      metadata: { kind: "role-created" },
    });
    return created;
  });
  revalidatePath("/admin/users");
  return ok({ id: role.id }, `Created "${role.name}".`);
}

/** A copy of an existing role to start a new one from ("HR" → "HR · HACA"). */
export async function duplicateRole(roleId: string): Promise<ActionResult<{ id: string }>> {
  const profile = await requirePermission("ROLES_MANAGE");
  const source = await prisma.reviewRole.findUnique({ where: { id: roleId } });
  if (!source) return fail("That role no longer exists.");
  if (source.isSuperAdmin) return fail("The Admin role can't be copied; make a new role instead.");
  if (!mayGrant(profile, source)) return fail("This role has more access than yours; you can't copy it.");
  let name = `${source.name} (copy)`;
  for (let i = 2; await prisma.reviewRole.findUnique({ where: { name } }); i++) name = `${source.name} (copy ${i})`;
  const copy = await prisma.reviewRole.create({
    data: {
      name,
      description: source.description,
      baseRole: source.baseRole,
      permissions: source.permissions,
      homeOrganizationId: source.homeOrganizationId,
    },
  });
  revalidatePath("/admin/users");
  return ok({ id: copy.id }, `Created "${name}". Rename it and adjust what it can do.`);
}

/** Deletes a custom role nobody has. Built-in roles stay. */
export async function deleteRole(roleId: string): Promise<ActionResult> {
  const profile = await requirePermission("ROLES_MANAGE");
  const role = await prisma.reviewRole.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) return fail("That role no longer exists.");
  if (role.isSystem) return fail("Built-in roles can't be deleted.");
  if (!mayGrant(profile, role)) return fail("This role has more access than yours; you can't delete it.");
  if (role._count.users > 0) return fail(`${role._count.users} ${role._count.users === 1 ? "person has" : "people have"} this role. Move them to another role first.`);
  await prisma.$transaction(async (tx) => {
    await tx.reviewRole.delete({ where: { id: role.id } });
    await writeAuditEvent(tx, {
      entityType: "ReviewRole",
      entityId: role.id,
      action: "USER_UPDATED",
      actorUserId: profile.user.id,
      actorEmail: profile.user.email,
      before: { name: role.name },
      metadata: { kind: "role-deleted" },
    });
  });
  revalidatePath("/admin/users");
  return ok(undefined, `Deleted "${role.name}".`);
}

/** Flips one permission on a role — the permission matrix's checkboxes. */
export async function setRolePermission(roleId: string, permission: ReviewPermission, granted: boolean): Promise<ActionResult> {
  const profile = await requirePermission("ROLES_MANAGE");
  const role = await prisma.reviewRole.findUnique({ where: { id: roleId } });
  if (!role) return fail("That role no longer exists.");
  if (role.isSuperAdmin) return fail("The Admin role always has every permission.");
  if (!mayGrant(profile, role)) return fail("This role has more access than yours; you can't change it.");
  if (granted && ungrantable(profile, [permission]).length) return fail("You can't grant a permission you don't have.");
  const permissions = granted ? [...new Set([...role.permissions, permission])] : role.permissions.filter((p) => p !== permission);
  await prisma.reviewRole.update({ where: { id: role.id }, data: { permissions } });
  revalidatePath("/admin/users");
  return ok(undefined, `${role.name}: ${PERMISSION_LABEL[permission]} ${granted ? "on" : "off"}.`);
}
