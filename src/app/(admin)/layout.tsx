import { requireAdmin } from "@/lib/rbac";
import { AppShell } from "@/components/shared/app-shell";
import { ROLE_LABEL } from "@/lib/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <AppShell userId={admin.id} role={admin.role} userName={admin.name} userMeta={ROLE_LABEL[admin.role]}>
      {children}
    </AppShell>
  );
}
