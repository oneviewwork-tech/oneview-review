import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AddEmployeeDialog } from "@/components/admin/add-employee-dialog";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { toggleEmployeeActive } from "@/actions/admin.actions";

export default async function AdminEmployeesPage() {
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: "asc" }, include: { department: { select: { name: true } } } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">Employees</h1>
          <p className="text-page-subtitle mt-1">Employees a Department Head can submit feedback for.</p>
        </div>
        <AddEmployeeDialog departments={departments} />
      </div>

      {employees.length === 0 ? (
        <EmptyState className="mt-6" title="No employees yet" description="Add a department first, then add employees to it." />
      ) : (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-metadata">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
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
                  <td className="px-4 py-2.5 text-muted-foreground">{e.department.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={e.isActive ? "success" : "neutral"}>{e.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ToggleActiveButton id={e.id} isActive={e.isActive} action={toggleEmployeeActive} />
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
