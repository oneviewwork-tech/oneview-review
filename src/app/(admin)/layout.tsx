import { requireHrAccess } from "@/lib/rbac";
import { AppShell } from "@/components/shared/app-shell";
import { ROLE_LABEL } from "@/lib/roles";

// Coarse gate only: HR or Admin. HR's one reason to be under /admin at all
// is /admin/employees (see proxy.ts); Departments and Users re-check
// requireAdmin() themselves, so this layout being permissive doesn't open
// those up.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHrAccess();

  return (
    <AppShell userId={user.id} departmentId={user.departmentId} role={user.role} userName={user.name} userMeta={ROLE_LABEL[user.role]}>
      {children}
    </AppShell>
  );
}
