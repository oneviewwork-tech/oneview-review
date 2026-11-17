import type { ReviewPermission } from "@prisma/client";

/** Who is acting, as far as handing out roles goes. */
export interface Grantor {
  isSuperAdmin: boolean;
  permissions: ReadonlySet<ReviewPermission>;
  /** The organization the actor's own role is pinned to, or null for all. */
  organizationId: string | null;
}

/** A role, as far as handing it out goes. */
export interface GrantableRole {
  isSuperAdmin: boolean;
  permissions: readonly ReviewPermission[];
  homeOrganizationId: string | null;
}

/**
 * No escalation: someone may give a role (or edit one) only if it grants
 * nothing they don't have themselves, and — when they are limited to one
 * organization — only a role limited to that same organization. The Admin
 * role is only ever handed out by an Admin.
 */
export function mayGrant(actor: Grantor, role: GrantableRole): boolean {
  if (actor.isSuperAdmin) return true;
  if (role.isSuperAdmin) return false;
  if (!role.permissions.every((p) => actor.permissions.has(p))) return false;
  if (actor.organizationId && role.homeOrganizationId !== actor.organizationId) return false;
  return true;
}

/** Permissions in `wanted` the actor can't hand out — empty when all are fine. */
export function ungrantable(actor: Grantor, wanted: readonly ReviewPermission[]): ReviewPermission[] {
  return actor.isSuperAdmin ? [] : wanted.filter((p) => !actor.permissions.has(p));
}
