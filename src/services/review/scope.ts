import { prisma } from "@/lib/prisma";
import { getAccessProfile } from "@/lib/rbac";
import { getSelectedOrgId } from "@/lib/org-scope";
import type { ScopeOrganization } from "@/components/hr/scope-filter";

/**
 * Organizations with their departments that the pages work across: the one
 * picked in the sidebar switcher, or all this person may see.
 */
export async function getScopeOrganizations(): Promise<ScopeOrganization[]> {
  const [all, selected] = await Promise.all([getAllScopeOrganizations(), getSelectedOrgId()]);
  const picked = selected ? all.filter((o) => o.id === selected) : [];
  return picked.length ? picked : all;
}

/** Every organization this person may see (the switcher's choices). */
export async function getAllScopeOrganizations(): Promise<ScopeOrganization[]> {
  // A role limited to one organization only ever gets that one to choose from.
  const pinned = (await getAccessProfile().catch(() => null))?.organizationId ?? null;
  const organizations = await prisma.organization.findMany({
    where: pinned ? { id: pinned } : {},
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      departments: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });
  return organizations;
}

/**
 * Turns `?org=&department=` into a Prisma filter.
 *
 * A department id is only honoured when it really belongs to the selected
 * organization, so a hand-edited URL can't mix the two and show one
 * entity's data under another's heading.
 */
export function resolveScope(
  organizations: ScopeOrganization[],
  params: { org?: string; department?: string }
): { organizationId?: string; departmentId?: string } {
  // With a single organization to choose from (a role limited to it), it is always the one.
  const organization = organizations.find((o) => o.id === params.org) ?? (organizations.length === 1 ? organizations[0] : undefined);
  const organizationId = organization?.id;

  const candidates = organization ? organization.departments : organizations.flatMap((o) => o.departments);
  const departmentId = candidates.find((d) => d.id === params.department)?.id;

  return {
    ...(organizationId ? { organizationId } : {}),
    ...(departmentId ? { departmentId } : {}),
  };
}
