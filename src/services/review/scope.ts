import { prisma } from "@/lib/prisma";
import type { ScopeOrganization } from "@/components/hr/scope-filter";

/** Organizations with their departments, for the HR scope picker. */
export async function getScopeOrganizations(): Promise<ScopeOrganization[]> {
  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
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
  const organization = organizations.find((o) => o.id === params.org);
  const organizationId = organization?.id;

  const candidates = organization ? organization.departments : organizations.flatMap((o) => o.departments);
  const departmentId = candidates.find((d) => d.id === params.department)?.id;

  return {
    ...(organizationId ? { organizationId } : {}),
    ...(departmentId ? { departmentId } : {}),
  };
}
