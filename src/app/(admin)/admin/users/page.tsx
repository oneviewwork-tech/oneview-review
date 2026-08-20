import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/shared/avatar";
import { ActiveBadge } from "@/components/shared/status-badge";
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
        <Card className="mt-6 overflow-hidden p-0"><div className="overflow-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Scope</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.name} />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate font-medium text-foreground">{u.name}</p>
                        <p className="truncate text-metadata">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge variant="brand">{ROLE_LABEL[u.role]}</Badge>
                  </td>
                  <td className="text-muted-foreground">
                    {u.department ? `${u.department.organization.name} — ${u.department.name}` : "All organizations"}
                  </td>
                  <td>
                    <ActiveBadge active={u.isActive} />
                  </td>
                  <td>
                    <div className="row-actions flex justify-end">
                      <ToggleActiveButton id={u.id} isActive={u.isActive} action={toggleUserActive} />
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
