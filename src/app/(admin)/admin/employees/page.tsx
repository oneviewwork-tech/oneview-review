import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { EmployeeDialog } from "@/components/admin/employee-dialog";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { toggleEmployeeActive } from "@/actions/admin.actions";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; department?: string }>;
}) {
  const params = await searchParams;
  const organizations = await getScopeOrganizations();
  const scope = resolveScope(organizations, params);

  const employees = await prisma.employee.findMany({
    where: {
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
    include: { department: { select: { name: true } }, organization: { select: { name: true } } },
  });

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page-title">Employees</h1>
          <p className="text-page-subtitle mt-1">
            {employees.length} {employees.length === 1 ? "person" : "people"} a Department Head can submit feedback for.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScopeFilter organizations={organizations} />
          <EmployeeDialog organizations={organizations} />
        </div>
      </div>

      {employees.length === 0 ? (
        <EmptyState className="mt-6" title="No employees" description="Add a department first, then add employees to it." />
      ) : (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-metadata">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Designation</th>
                <th className="px-4 py-2.5 font-medium">Organization</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-border-subtle transition-ui last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">{e.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.email}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.designation ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.organization.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.department.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={e.isActive ? "success" : "neutral"}>{e.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
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
        </Card>
      )}
    </div>
  );
}
