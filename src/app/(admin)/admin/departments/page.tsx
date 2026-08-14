import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AddDepartmentDialog } from "@/components/admin/add-department-dialog";

export default async function AdminDepartmentsPage() {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true, users: true } } },
  });

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">Departments</h1>
          <p className="text-page-subtitle mt-1">Departments employees and Department Heads belong to.</p>
        </div>
        <AddDepartmentDialog />
      </div>

      {departments.length === 0 ? (
        <EmptyState className="mt-6" title="No departments yet" description="Add one to start assigning employees and heads." />
      ) : (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-metadata">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Employees</th>
                <th className="px-4 py-2.5 font-medium">Department Heads</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-border-subtle transition-ui last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">{d.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.code}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d._count.employees}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d._count.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
