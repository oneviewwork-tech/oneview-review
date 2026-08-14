import { requireReviewAccess } from "@/lib/rbac";
import { AppShell } from "@/components/shared/app-shell";
import { ROLE_LABEL } from "@/lib/roles";

export default async function DepartmentHeadLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireReviewAccess();

  return (
    <AppShell
      role={user.role}
      userName={user.name}
      // A Department Head is identified by their department; an Admin
      // acting here has none, so fall back to the role name.
      userMeta={user.department?.name ?? ROLE_LABEL[user.role]}
    >
      {children}
    </AppShell>
  );
}
