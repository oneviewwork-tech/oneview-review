import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";

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
  // Department Head's layout needs its name on every page, and the DB is in
  // Singapore, so a second round trip costs far more than this join.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { department: { select: { id: true, name: true, code: true } } },
  });
  if (!user || !user.isActive) throw new UnauthenticatedError();
  return user;
});

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
 * A Department Head is locked to their own department — this is the §8
 * boundary and the reason `departmentId` is returned rather than taken
 * from the request. An Admin has no department of their own but may act
 * for any, so `departmentId` is null for them and the caller must resolve
 * which department is being acted on (and pass it to requireOwnsEmployee,
 * which re-checks the employee actually belongs to it).
 */
export async function requireReviewAccess() {
  const user = await requireUser();
  if (user.role === "ADMIN") {
    return { user, departmentId: null as string | null, isAdmin: true as const };
  }
  if (user.role !== "DEPARTMENT_HEAD" || !user.departmentId) {
    void logDenied(user.id, user.email, "not_department_head");
    throw new ForbiddenError("This page is only available to Department Heads.");
  }
  return { user, departmentId: user.departmentId as string | null, isAdmin: false as const };
}

/**
 * Access to HR's review/confirm/send surface. Admin is a deliberate
 * superset of HR — anything HR can do, an Admin can do.
 */
export async function requireHrAccess() {
  const user = await requireUser();
  if (user.role !== "HR" && user.role !== "ADMIN") {
    void logDenied(user.id, user.email, "not_hr");
    throw new ForbiddenError("This page is only available to HR.");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    void logDenied(user.id, user.email, "not_admin");
    throw new ForbiddenError("This page is only available to Admins.");
  }
  return user;
}

/**
 * Throws unless a Department Head owns the given employee (i.e. the
 * employee's departmentId matches theirs). This is the backend enforcement
 * the spec insists on (§8: "Do not rely only on frontend filtering") —
 * every submission-creating action must call this, not just filter the
 * dropdown that fed it.
 */
export async function requireOwnsEmployee(departmentId: string, employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.departmentId !== departmentId || !employee.isActive) {
    throw new ForbiddenError("You do not have access to this employee.");
  }
  return employee;
}
