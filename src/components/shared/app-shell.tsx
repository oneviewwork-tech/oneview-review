import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { Breadcrumb } from "@/components/shared/breadcrumb";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ToastProvider } from "@/components/ui/toast";
import { signOutAction } from "@/actions/auth.actions";
import { navigationForRole } from "@/lib/navigation";
import { getSidebarData } from "@/services/review/sidebar";
import type { UserRole } from "@prisma/client";

/**
 * The single application shell. Every role renders through this, so the
 * product reads as one app with one sidebar rather than three separate
 * header layouts — only the nav contents differ, by role.
 *
 * The sidebar-plus-top-bar arrangement mirrors ONEVIEW People, so the two
 * products in the family behave the same way.
 */
export async function AppShell({
  userId,
  departmentId,
  role,
  userName,
  userMeta,
  children,
}: {
  userId: string;
  departmentId: string | null;
  role: UserRole;
  userName: string;
  userMeta: string;
  children: React.ReactNode;
}) {
  const { badges, cycle } = await getSidebarData({ id: userId, role, departmentId });

  return (
    <ToastProvider>
      <div className="flex min-h-full flex-1">
        <AppSidebar
          sections={navigationForRole(role)}
          userName={userName}
          userMeta={userMeta}
          badges={badges}
          cycle={cycle}
          signOut={signOutAction}
        />

        <div className="flex min-w-0 flex-1 flex-col pl-[var(--sidebar-w)]">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-6">
            <Breadcrumb />
            <div className="flex-1" />
            <ThemeToggle />
            <Link
              href="/change-password"
              aria-label="Change password"
              title="Change password"
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
            >
              <KeyRound className="size-4" />
            </Link>
          </header>

          <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
