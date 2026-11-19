import { AlertTriangle, Building2, Crown, KeyRound, ShieldCheck, ShieldHalf, Users as UsersIcon } from "lucide-react";
import type { ReviewPermission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/shared/avatar";
import { ActiveBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { UserDialog, type AssignableRole } from "@/components/admin/user-dialog";
import { SearchField } from "@/components/shared/search-field";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { RoleTabs } from "@/components/admin/roles/role-tabs";
import { RoleDialog } from "@/components/admin/roles/role-dialog";
import { PermissionToggle, RoleRowActions } from "@/components/admin/roles/role-actions";
import { toggleUserActive } from "@/actions/admin.actions";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, systemRoleFor } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";
import { mayGrant, ungrantable } from "@/domain/roles";
import { peopleAccountsByEmail } from "@/services/people/directory";
import { getScopeOrganizations } from "@/services/review/scope";
import { cn } from "@/lib/utils";

/**
 * Users & Roles, as in ONEVIEW People: roles are named sets of permissions
 * (optionally limited to one organization); people are given a role. Three
 * tabs — Roles, Permissions (the matrix), User accounts. What you can change
 * is limited by your own role: nobody hands out more than they have.
 */
export default async function UsersAndRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim() ?? "";
  const profile = await requirePermission("USERS_MANAGE", "ROLES_MANAGE");
  const canManageRoles = profile.can("ROLES_MANAGE");
  const canManageUsers = profile.can("USERS_MANAGE");

  const [users, roles, organizations] = await Promise.all([
    prisma.user.findMany({
      // A role limited to one organization manages only that organization's people
      // (their department's organization; accounts with no department are shared).
      where: profile.organizationId
        ? { OR: [{ department: { organizationId: profile.organizationId } }, { departmentId: null }] }
        : {},
      orderBy: { name: "asc" },
      include: {
        department: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } },
        reviewRole: { select: { id: true, name: true, isSuperAdmin: true, permissions: true, homeOrganizationId: true } },
      },
    }),
    prisma.reviewRole.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { homeOrganization: { select: { name: true } }, _count: { select: { users: true } } },
    }),
    getScopeOrganizations(),
  ]);
  const people = await peopleAccountsByEmail(users.map((u) => u.email));
  const noAccount = users.filter((u) => u.isActive && !people.get(u.email.toLowerCase())?.isActive);

  const matchesQuery = (u: (typeof users)[number]) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const roleName = u.reviewRole?.name ?? systemRoleFor(u.role).name;
    return u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || roleName.toLowerCase().includes(needle);
  };
  const filteredUsers = users.filter(matchesQuery);

  const assignable: AssignableRole[] = roles
    .filter((r) => mayGrant(profile, r))
    .map((r) => ({ id: r.id, name: r.name, baseRole: r.baseRole, description: r.description, organizationName: r.homeOrganization?.name ?? null }));
  const grantable = ALL_PERMISSIONS.filter((p) => ungrantable(profile, [p]).length === 0);
  const orgOptions = organizations.map((o) => ({ id: o.id, name: o.name }));

  const stats = [
    { label: "Roles", value: roles.length, icon: ShieldHalf },
    { label: "Custom roles", value: roles.filter((r) => !r.isSystem).length, icon: KeyRound },
    { label: "Limited to one organization", value: roles.filter((r) => r.homeOrganizationId).length, icon: Building2 },
    { label: "Permission types", value: ALL_PERMISSIONS.length, icon: ShieldCheck },
  ];

  // ── Roles ───────────────────────────────────────────────────────────
  const rolesTab = (
    <Card className="overflow-hidden p-0">
      <div className="overflow-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th>Role</th>
              <th>Kind</th>
              <th>Organization</th>
              <th>Permissions</th>
              <th>People</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => {
              const editable = canManageRoles && !r.isSuperAdmin && mayGrant(profile, r);
              return (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                          r.isSuperAdmin ? "bg-ink text-ink-foreground" : r.isSystem ? "bg-brand-subtle text-brand" : "bg-muted text-foreground"
                        )}
                      >
                        {r.isSuperAdmin ? <Crown className="size-4" /> : <ShieldHalf className="size-4" />}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="flex items-center gap-2 font-medium">
                          {r.name}
                          {r.isSystem && <Badge variant="neutral">Built-in</Badge>}
                        </span>
                        {r.description && <span className="mt-0.5 block max-w-md text-xs text-muted-foreground">{r.description}</span>}
                      </span>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{ROLE_LABEL[r.baseRole]}</td>
                  <td>
                    {r.homeOrganization ? <Badge variant="brand">{r.homeOrganization.name} only</Badge> : <span className="text-muted-foreground">Every organization</span>}
                  </td>
                  <td className="tabular-nums">
                    {r.isSuperAdmin ? "All" : r.permissions.length}
                    <span className="text-muted-foreground"> / {ALL_PERMISSIONS.length}</span>
                  </td>
                  <td className="tabular-nums">{r._count.users}</td>
                  <td>
                    <div className="row-actions flex justify-end gap-1">
                      {editable && (
                        <RoleDialog
                          role={{
                            id: r.id,
                            name: r.name,
                            description: r.description,
                            baseRole: r.baseRole,
                            isSystem: r.isSystem,
                            permissions: r.permissions,
                            homeOrganizationId: r.homeOrganizationId,
                          }}
                          organizations={orgOptions}
                          grantable={grantable}
                          lockedOrganizationId={profile.organizationId}
                          canMakeAdminType={profile.isSuperAdmin}
                        />
                      )}
                      {canManageRoles && (
                        <RoleRowActions
                          roleId={r.id}
                          name={r.name}
                          canDuplicate={!r.isSuperAdmin && mayGrant(profile, r)}
                          canDelete={editable && !r.isSystem && r._count.users === 0}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // ── Permissions matrix ─────────────────────────────────────────────
  const permissionsTab = (
    <Card className="overflow-hidden p-0">
      <div className="overflow-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permission
              </th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-3 text-center text-xs font-semibold">
                  <span className="block">{r.name}</span>
                  {r.homeOrganization && <span className="block font-normal text-muted-foreground">{r.homeOrganization.name}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <PermissionGroupRows
                key={g.key}
                label={g.label}
                colSpan={roles.length + 1}
                rows={g.permissions.map((p) => ({
                  key: p.key,
                  label: p.label,
                  description: p.description,
                  cells: roles.map((r) => {
                    const granted = r.isSuperAdmin || r.permissions.includes(p.key);
                    const editable = canManageRoles && !r.isSuperAdmin && mayGrant(profile, r) && (granted || ungrantable(profile, [p.key]).length === 0);
                    return { roleId: r.id, granted, editable, roleName: r.name };
                  }),
                }))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  // ── User accounts ──────────────────────────────────────────────────
  const usersTab =
    users.length === 0 ? (
      <EmptyState title="No users yet" description="Add someone from People to give them a role in Review." />
    ) : (
      <div className="space-y-3">
        <SearchField className="w-full sm:w-72" placeholder="Search name, email, or role…" />
        {filteredUsers.length === 0 ? (
          <EmptyState title={`No one matches "${q}"`} description="Try a different name, email, or role." />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-auto">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Scope</th>
                    <th>In People</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const account = people.get(u.email.toLowerCase());
                    const fallback = systemRoleFor(u.role);
                    const current = u.reviewRole ?? { isSuperAdmin: fallback.isSuperAdmin, permissions: fallback.permissions as ReviewPermission[], homeOrganizationId: null };
                    const manageable = canManageUsers && mayGrant(profile, current);
                    const roleName = u.reviewRole?.name ?? fallback.name;
                    return (
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
                          <Badge variant={current.isSuperAdmin ? "neutral" : "brand"}>{roleName}</Badge>
                        </td>
                        <td className="text-muted-foreground">
                          {u.department ? `${u.department.organization.name} · ${u.department.name}` : "-"}
                        </td>
                        <td className="text-muted-foreground">
                          {account?.isActive ? (
                            <span className="leading-tight">
                              <span className="block text-foreground">{account.peopleRole}</span>
                              {account.designation && <span className="block text-xs">{account.designation}</span>}
                            </span>
                          ) : (
                            <span className="text-warning">No account</span>
                          )}
                        </td>
                        <td>
                          <ActiveBadge active={u.isActive} />
                        </td>
                        <td>
                          <div className="row-actions flex justify-end gap-1">
                            {manageable && (
                              <>
                                <UserDialog
                                  organizations={organizations}
                                  roles={assignable}
                                  user={{
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                    roleId: u.reviewRoleId,
                                    departmentId: u.department?.id ?? null,
                                    organizationId: u.department?.organization.id ?? null,
                                  }}
                                />
                                <ToggleActiveButton id={u.id} isActive={u.isActive} action={toggleUserActive} />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Users & Roles"
        description="Everyone signs in with their ONEVIEW People account. Roles decide what each person can do in Review."
        actions={
          <>
            {canManageRoles && (
              <RoleDialog organizations={orgOptions} grantable={grantable} lockedOrganizationId={profile.organizationId} canMakeAdminType={profile.isSuperAdmin} />
            )}
            {canManageUsers && <UserDialog organizations={organizations} roles={assignable} />}
          </>
        }
      />

      {noAccount.length > 0 && (
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>{noAccount.length}</strong> active {noAccount.length === 1 ? "user has" : "users have"} no matching People account and
            can&apos;t sign in: {noAccount.map((u) => u.name).join(", ")}.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-4 rounded-[1.4rem] bg-card p-5 shadow-sm">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
              <s.icon className="size-5" />
            </span>
            <span>
              <span className="block text-3xl font-semibold leading-none tabular-nums">{s.value}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{s.label}</span>
            </span>
          </div>
        ))}
      </div>

      <RoleTabs
        initial={canManageRoles ? "roles" : "users"}
        tabs={[
          { id: "roles", label: "Roles", count: roles.length, icon: <ShieldHalf className="size-4" />, content: rolesTab },
          { id: "permissions", label: "Permissions", count: ALL_PERMISSIONS.length, icon: <ShieldCheck className="size-4" />, content: permissionsTab },
          { id: "users", label: "User accounts", count: users.length, icon: <UsersIcon className="size-4" />, content: usersTab },
        ]}
      />
    </div>
  );
}

function PermissionGroupRows({
  label,
  colSpan,
  rows,
}: {
  label: string;
  colSpan: number;
  rows: { key: ReviewPermission; label: string; description: string; cells: { roleId: string; granted: boolean; editable: boolean; roleName: string }[] }[];
}) {
  return (
    <>
      <tr>
        <td colSpan={colSpan} className="border-t border-border bg-muted/50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-brand">
          {label}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className="hover:bg-muted/30">
          <td className="sticky left-0 z-10 border-t border-border bg-card px-5 py-2.5">
            <span className="block font-medium">{row.label}</span>
            <span className="block max-w-sm text-xs text-muted-foreground">{row.description}</span>
          </td>
          {row.cells.map((c) => (
            <td key={c.roleId} className="border-t border-border px-3 py-2.5 text-center">
              <PermissionToggle roleId={c.roleId} permission={row.key} granted={c.granted} disabled={!c.editable} label={`${row.label} for ${c.roleName}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
