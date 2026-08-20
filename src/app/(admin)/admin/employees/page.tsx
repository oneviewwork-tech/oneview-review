import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/shared/avatar";
import { ActiveBadge } from "@/components/shared/status-badge";
import { SearchField } from "@/components/shared/search-field";
import { EmployeeDialog } from "@/components/admin/employee-dialog";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { toggleEmployeeActive } from "@/actions/admin.actions";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; department?: string; q?: string }>;
}) {
  const params = await searchParams;
  const organizations = await getScopeOrganizations();
  const scope = resolveScope(organizations, params);
  const q = params.q?.trim() ?? "";

  const search: Prisma.EmployeeWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { designation: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
        ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        ...search,
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
      include: { department: { select: { name: true } }, organization: { select: { name: true } } },
    }),
    prisma.employee.count(),
  ]);

  // The organization column is pure repetition once a single organization is
  // selected — every row would say the same thing.
  const showOrgColumn = !scope.organizationId;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Employees"
        description={
          q || scope.organizationId || scope.departmentId
            ? `${employees.length} of ${total} shown`
            : `${total} people a Department Head can submit feedback for.`
        }
        actions={<EmployeeDialog organizations={organizations} />}
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchField className="w-full sm:w-72" placeholder="Search name, email, or role…" />
        <ScopeFilter organizations={organizations} />
      </div>

      {employees.length === 0 ? (
        <EmptyState
          className="mt-5"
          title={q ? `No one matches “${q}”` : "No employees"}
          description={q ? "Try a different name, email, or role." : "Add a department first, then add employees to it."}
        />
      ) : (
        <Card className="mt-5 overflow-hidden p-0">
          <div className="max-h-[calc(100vh-19rem)] overflow-auto">
            <table className="data-table table-sticky-head min-w-[820px]">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  {showOrgColumn && <th>Organization</th>}
                  <th>Department</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate font-medium text-foreground">{e.name}</p>
                          <p className="truncate text-metadata">{e.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground">{e.designation ?? "—"}</td>
                    {showOrgColumn && <td className="text-muted-foreground">{e.organization.name}</td>}
                    <td className="text-muted-foreground">{e.department.name}</td>
                    <td>
                      <ActiveBadge active={e.isActive} />
                    </td>
                    <td>
                      <div className="row-actions flex items-center justify-end gap-1">
                        <EmployeeDialog
                          organizations={organizations}
                          employee={{
                            id: e.id,
                            name: e.name,
                            email: e.email,
                            departmentId: e.departmentId,
                            organizationId: e.organizationId,
                            designation: e.designation,
                          }}
                        />
                        <ToggleActiveButton id={e.id} isActive={e.isActive} action={toggleEmployeeActive} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
