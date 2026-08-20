import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AddUserDialog } from "@/components/admin/add-user-dialog";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { toggleUserActive } from "@/actions/admin.actions";
import { ROLE_LABEL } from "@/lib/roles";
import { getScopeOrganizations } from "@/services/review/scope";

export default async function AdminUsersPage() {
  const [users, organizations] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { department: { select: { name: true, organization: { select: { name: true } } } } },
    }),
    getScopeOrganizations(),
  ]);

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">Users</h1>
          <p className="text-page-subtitle mt-1">Department Heads, HR, and Admin logins.</p>
        </div>
        <AddUserDialog organizations={organizations} />
      </div>

      {users.length === 0 ? (
        <EmptyState className="mt-6" title="No users yet" description="Add the first user to get started." />
      ) : (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-metadata">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Scope</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border-subtle transition-ui last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="brand">{ROLE_LABEL[u.role]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {u.department ? `${u.department.organization.name} — ${u.department.name}` : "All organizations"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={u.isActive ? "success" : "neutral"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ToggleActiveButton id={u.id} isActive={u.isActive} action={toggleUserActive} />
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
