import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchField } from "@/components/shared/search-field";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { AssignmentRow } from "@/components/performance/assignment-row";
import { requirePermission } from "@/lib/rbac";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";
import { ROLE_LABEL } from "@/lib/roles";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; department?: string; q?: string; filter?: string }>;
}) {
  await requirePermission("PERF_SETUP");
  const params = await searchParams;
  const organizations = await getScopeOrganizations();
  const scope = resolveScope(organizations, params);
  const q = params.q?.trim() ?? "";
  const onlyUnassigned = params.filter === "unassigned";

  const search: Prisma.EmployeeWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { designation: { contains: q, mode: "insensitive" } }] }
    : {};

  const [employees, templates, scorers, assignedCount, total] = await Promise.all([
    prisma.employee.findMany({
      where: {
        isActive: true,
        ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...(onlyUnassigned ? { perfAssignment: null } : {}),
        ...search,
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      include: {
        department: { select: { name: true } },
        organization: { select: { code: true } },
        perfAssignment: { select: { templateId: true, scorerUserId: true } },
      },
    }),
    prisma.perfTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.perfAssignment.count(),
    prisma.employee.count({ where: { isActive: true } }),
  ]);

  const showOrg = !scope.organizationId;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Assignments"
        description={`Choose each person's scorecard and who scores them. ${assignedCount} of ${total} active employees are assigned.`}
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchField className="w-full sm:w-72" placeholder="Search name or role…" />
        <ScopeFilter organizations={organizations} />
      </div>

      {templates.length === 0 ? (
        <EmptyState className="mt-5" title="Create a scorecard first" description="Assignments pick from the scorecards under Scorecards." />
      ) : employees.length === 0 ? (
        <EmptyState className="mt-5" title="No one matches" description="Try a different search or scope." />
      ) : (
        <Card className="mt-5 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="text-metadata px-4 py-3 font-semibold">Employee</th>
                <th className="text-metadata px-4 py-3 font-semibold">Scorecard</th>
                <th className="text-metadata px-4 py-3 font-semibold">Scored by</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <AssignmentRow
                  key={`${e.id}-${e.perfAssignment?.templateId ?? ""}-${e.perfAssignment?.scorerUserId ?? ""}`}
                  employee={{
                    id: e.id,
                    name: e.name,
                    meta: `${e.designation ?? "-"} · ${e.department.name}${showOrg ? ` · ${e.organization.code}` : ""}`,
                  }}
                  templates={templates.map((t) => ({ value: t.id, label: t.name }))}
                  scorers={scorers.map((u) => ({ value: u.id, label: u.name, hint: ROLE_LABEL[u.role] }))}
                  current={e.perfAssignment}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
