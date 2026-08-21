import { AppSidebar } from "@/components/shared/app-sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { signOutAction } from "@/actions/auth.actions";
import { navigationForRole } from "@/lib/navigation";
import { getNavBadges } from "@/services/review/nav-badges";
import type { UserRole } from "@prisma/client";

/**
 * The single application shell. Every role renders through this, so the
 * product reads as one app with one sidebar rather than three separate
 * header layouts — only the nav contents differ, by role.
 */
export async function AppShell({
  userId,
  role,
  userName,
  userMeta,
  children,
}: {
  userId: string;
  role: UserRole;
  userName: string;
  userMeta: string;
  children: React.ReactNode;
}) {
  const badges = await getNavBadges({ id: userId, role });

  return (
    <ToastProvider>
      <div className="flex min-h-full flex-1">
        <AppSidebar
          sections={navigationForRole(role)}
          userName={userName}
          userMeta={userMeta}
          badges={badges}
          signOut={signOutAction}
        />
        <div className="flex min-w-0 flex-1 flex-col pl-[var(--sidebar-w)]">
          <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
