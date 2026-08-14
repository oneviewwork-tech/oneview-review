import { AppSidebar } from "@/components/shared/app-sidebar";
import { signOutAction } from "@/actions/auth.actions";
import { navigationForRole } from "@/lib/navigation";
import type { UserRole } from "@prisma/client";

/**
 * The single application shell. Every role renders through this, so the
 * product reads as one app with one sidebar rather than three separate
 * header layouts — only the nav contents differ, by role.
 */
export function AppShell({
  role,
  userName,
  userMeta,
  children,
}: {
  role: UserRole;
  userName: string;
  userMeta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar
        sections={navigationForRole(role)}
        userName={userName}
        userMeta={userMeta}
        signOut={signOutAction}
      />
      <div className="flex min-w-0 flex-1 flex-col pl-[var(--sidebar-w)]">
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
