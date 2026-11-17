import { Suspense } from "react";
import { after } from "next/server";
import { AppSidebarLayout } from "@/components/shared/app-sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { signOutAction } from "@/actions/auth.actions";
import { navigationForRole } from "@/lib/navigation";
import { getNavBadges } from "@/services/review/sidebar";
import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getAccessProfile } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/roles";
import { accountSwitcherEnabled } from "@/lib/account-switcher";
import { AccountSwitcher } from "@/components/shared/account-switcher";
import { brandForOrgCode } from "@/components/shared/brand-logo";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { getMyNotifications, syncScoringReminders } from "@/services/notifications/in-app";
import { syncPeopleIfStale } from "@/services/people/auto-sync";

/**
 * The bell. Before reading, it tops up this person's scoring reminders (one
 * per unscored finished week), so reminders appear without a scheduled job.
 */
async function Bell({ userId }: { userId: string }) {
  await syncScoringReminders(userId).catch(() => {});
  const { items, unread } = await getMyNotifications(userId);
  return <NotificationsBell items={items} unread={unread} />;
}

/** Test-only switcher: every active account, when enabled; otherwise nothing. */
async function Switcher() {
  if (!accountSwitcherEnabled()) return null;
  const [session, users] = await Promise.all([
    auth(),
    prisma.user.findMany({ where: { isActive: true }, select: { email: true, name: true, role: true }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <AccountSwitcher
      currentEmail={session?.user?.email ?? ""}
      accounts={users.map((u) => ({ email: u.email, name: u.name, roleLabel: ROLE_LABEL[u.role] }))}
    />
  );
}

/**
 * The single application shell. Every role renders through this, so the
 * product reads as one app — Performance and Feedback together — with one
 * menu; only its contents differ, by role.
 *
 * Everything sits on one rounded canvas with a thin frame around it, with
 * the pill menu floating across the top.
 *
 * The menu's counts come from the database, which is a network hop away, so
 * they are not awaited: the menu paints at once without them and the numbers
 * stream in when the query returns. Nothing on the page waits on them.
 */
export async function AppShell({
  userId,
  role,
  userName,
  userMeta,
  employeeOnly,
  children,
}: {
  userId: string;
  departmentId?: string | null;
  role: UserRole;
  userName: string;
  userMeta: string;
  /** An employee who scores nobody: the menu shrinks to their own scorecard. */
  employeeOnly?: boolean;
  children: React.ReactNode;
}) {
  const profile = await getAccessProfile();
  // Keep employees in step with ONEVIEW People (joiners, leavers), after the page is sent.
  after(syncPeopleIfStale);
  const sections = navigationForRole(role, { employeeOnly, can: profile.can });
  const badges = getNavBadges({ id: userId, reviewsFeedback: profile.can("FEEDBACK_REVIEW"), decidesAny: profile.can("PERF_DECIDE_ANY") }).catch(() => ({}));
  // The person's own organization, for the logo: their department's, or their employee record's.
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, department: { select: { organization: { select: { code: true } } } } },
  });
  const pinnedOrg = profile.organizationId
    ? (await prisma.organization.findUnique({ where: { id: profile.organizationId }, select: { code: true } }))?.code
    : null;
  const ownOrg =
    pinnedOrg ??
    me?.department?.organization.code ??
    (me
      ? (
          await prisma.employee.findFirst({
            where: { OR: [{ email: { equals: me.email, mode: "insensitive" } }, { peopleEmail: { equals: me.email, mode: "insensitive" } }] },
            select: { organization: { select: { code: true } } },
          })
        )?.organization.code
      : null);
  const brandProps = { homeBrand: brandForOrgCode(ownOrg), seesAllOrgs: profile.can("PERF_VIEW_ALL") && !profile.organizationId };

  return (
    <ToastProvider>
        <AppSidebarLayout
          {...brandProps}
          sections={sections}
          userName={userName}
          userMeta={userMeta}
          badges={badges}
          signOut={signOutAction}
          switcher={<Switcher />}
          bell={<Suspense fallback={null}><Bell userId={userId} /></Suspense>}
        >
          {children}
        </AppSidebarLayout>
    </ToastProvider>
  );
}
