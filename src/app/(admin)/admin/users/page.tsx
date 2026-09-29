import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/shared/avatar";
import { ActiveBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { UserDialog } from "@/components/admin/user-dialog";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { toggleUserActive } from "@/actions/admin.actions";
import { ROLE_LABEL } from "@/lib/roles";
import { getScopeOrganizations } from "@/services/review/scope";

export default async function AdminUsersPage() {
  // The (admin) layout now also admits HR (for /admin/employees) — this
  // page stays Admin-only, so it checks for itself.
  await requireAdmin();

  const [users, organizations] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { department: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } } },
    }),
    getScopeOrganizations(),
  ]);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Users"
        description="Who can sign in, and what each of them can reach."
        actions={<UserDialog organizations={organizations} />}
      />

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
                    <div className="row-actions flex justify-end gap-1">
                      <UserDialog
                        organizations={organizations}
                        user={{
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          departmentId: u.department?.id ?? null,
                          organizationId: u.department?.organization.id ?? null,
                        }}
                      />
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
