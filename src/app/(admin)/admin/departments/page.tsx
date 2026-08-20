import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AddDepartmentDialog } from "@/components/admin/add-department-dialog";

export default async function AdminDepartmentsPage() {
  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      departments: {
        orderBy: { name: "asc" },
        include: { _count: { select: { employees: true, users: true } } },
      },
    },
  });

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Departments"
        description="Grouped by organization. Every employee and Department Head belongs to exactly one."
        actions={<AddDepartmentDialog organizations={organizations.map((o) => ({ id: o.id, name: o.name }))} />}
      />

      <div className="mt-6 space-y-6">
        {organizations.map((org) => (
          <section key={org.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-section-title">{org.name}</h2>
              <span className="text-metadata">
                {org.departments.length} {org.departments.length === 1 ? "department" : "departments"}
              </span>
            </div>

            {org.departments.length === 0 ? (
              <EmptyState title={`No departments in ${org.name}`} description="Add one to start assigning employees." />
            ) : (
              <Card className="overflow-x-auto p-0">
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
                    {org.departments.map((d) => (
                      <tr key={d.id} className="border-b border-border-subtle transition-ui last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2.5 font-medium text-foreground">{d.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.code}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{d._count.employees}</td>
                        <td className={`px-4 py-2.5 ${d._count.users === 0 ? "text-warning" : "text-muted-foreground"}`}>
                          {d._count.users === 0 ? "None assigned" : d._count.users}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
