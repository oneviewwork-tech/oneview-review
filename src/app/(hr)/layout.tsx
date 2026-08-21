import { requireHrAccess } from "@/lib/rbac";
import { AppShell } from "@/components/shared/app-shell";
import { ROLE_LABEL } from "@/lib/roles";

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const user = await requireHrAccess();

  return (
    <AppShell userId={user.id} role={user.role} userName={user.name} userMeta={ROLE_LABEL[user.role]}>
      {children}
    </AppShell>
  );
}
