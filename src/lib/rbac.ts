import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import type { ReviewPermission } from "@prisma/client";
import { ALL_PERMISSIONS, systemRoleFor } from "@/lib/permissions";

export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Cheap JWT-only check. Wrapped in cache() so a layout/page chain shares one result per request. */
export const requireSession = cache(async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  return session;
});

/**
 * Re-reads the User row so a deactivated account is rejected immediately
 * rather than riding out its JWT until expiry. Every server action and
 * every data-bearing page should call this, not just requireSession().
 */
export const requireUser = cache(async function requireUser() {
  const session = await requireSession();
  // The department is joined here rather than fetched separately: a
  // Team Lead's layout needs its name on every page, and the DB is in
  // Singapore, so a second round trip costs far more than this join.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      department: { select: { id: true, name: true, code: true } },
      reviewRole: { select: { id: true, name: true, isSuperAdmin: true, permissions: true, homeOrganizationId: true } },
    },
  });
  // The account behind this session is gone or switched off (deactivated,
  // or a test database re-seeded under it): send them to sign in again
  // rather than failing the page.
  if (!user || !user.isActive) redirect("/signed-out");
  return user;
});

export interface AccessProfile {
  user: Awaited<ReturnType<typeof requireUser>>;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: Set<ReviewPermission>;
  /** The one organization this person is limited to, or null for all of them. */
  organizationId: string | null;
  can: (permission: ReviewPermission) => boolean;
}

/**
 * What the signed-in person may do: their role's permissions and its
 * organization pin. Someone not yet attached to a role row gets the
 * built-in role for their base role. The Admin role has everything.
 */
export const getAccessProfile = cache(async function getAccessProfile(): Promise<AccessProfile> {
  const user = await requireUser();
  const role = user.reviewRole;
  const fallback = systemRoleFor(user.role);
  const isSuperAdmin = role ? role.isSuperAdmin : fallback.isSuperAdmin;
  const permissions = new Set<ReviewPermission>(isSuperAdmin ? ALL_PERMISSIONS : (role?.permissions ?? fallback.permissions));
  return {
    user,
    roleName: role?.name ?? fallback.name,
    isSuperAdmin,
    permissions,
    organizationId: isSuperAdmin ? null : (role?.homeOrganizationId ?? null),
    can: (p) => permissions.has(p),
  };
});

/** Throws unless the signed-in person's role grants at least one of these permissions. */
export async function requirePermission(...anyOf: ReviewPermission[]) {
  const profile = await getAccessProfile();
  if (!anyOf.some((p) => profile.permissions.has(p))) {
    void logDenied(profile.user.id, profile.user.email, "missing_permission", { needed: anyOf });
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return profile;
}

async function logDenied(actorId: string, actorEmail: string, reason: string, metadata?: unknown) {
  writeAuditEvent(prisma, {
    entityType: "AccessControl",
    entityId: actorId,
    action: "ACCESS_DENIED",
    actorUserId: actorId,
    actorEmail,
    metadata: { reason, ...(typeof metadata === "object" && metadata ? metadata : {}) },
  }).catch(() => {});
}

/**
 * Access to the review-submission surface.
 *
 * A Team Lead is locked to their own department — this is the §8
 * boundary and the reason `departmentId` is returned rather than taken
 * from the request. An Admin has no department of their own but may act
 * for any, so `departmentId` is null for them and the caller must resolve
 * which department is being acted on (and pass it to requireOwnsEmployee,
 * which re-checks the employee actually belongs to it).
 */
export async function requireReviewAccess() {
  const profile = await getAccessProfile();
  const user = profile.user;
  // "Submit feedback for anyone" acts for any department (within the role's organization).
  if (profile.can("FEEDBACK_SUBMIT_ANY")) {
    return { user, departmentId: null as string | null, isAdmin: true as const };
  }
  if (user.role !== "DEPARTMENT_HEAD" || !user.departmentId) {
    void logDenied(user.id, user.email, "not_department_head");
    throw new ForbiddenError("This page is only available to Team Leads.");
  }
  return { user, departmentId: user.departmentId as string | null, isAdmin: false as const };
}

/**
 * Throws unless a Team Lead owns the given employee — either as their
 * home department, or as one of the employee's additional department
 * links (EmployeeDepartmentLink; e.g. a department head who is also
 * reviewed, as an individual, under a different department). This is the
 * backend enforcement the spec insists on (§8: "Do not rely only on
 * frontend filtering") — every submission-creating action must call this,
 * not just filter the dropdown that fed it.
 */
export async function requireOwnsEmployee(departmentId: string, employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { additionalDepartments: { select: { departmentId: true } } },
  });
  const owns =
    employee?.departmentId === departmentId ||
    employee?.additionalDepartments.some((l) => l.departmentId === departmentId);
  if (!employee || !owns || !employee.isActive) {
    throw new ForbiddenError("You do not have access to this employee.");
  }
  return employee;
}
