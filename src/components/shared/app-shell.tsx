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
import { photoUrlFor } from "@/services/people/photo";
import { getAllScopeOrganizations } from "@/services/review/scope";
import { getSelectedOrgId } from "@/lib/org-scope";
import type { Brand } from "@/components/shared/brand-logo";

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
  // Their own employee record: for the logo when they have no department, and for their photo.
  const ownEmployee = me
    ? await prisma.employee.findFirst({
        where: { OR: [{ email: { equals: me.email, mode: "insensitive" } }, { peopleEmail: { equals: me.email, mode: "insensitive" } }] },
        orderBy: { isActive: "desc" },
        select: { id: true, organization: { select: { code: true } } },
      })
    : null;
  const ownOrg = pinnedOrg ?? me?.department?.organization.code ?? ownEmployee?.organization.code ?? null;
  const userPhoto = ownEmployee ? await photoUrlFor(ownEmployee.id).catch(() => undefined) : undefined;
  // HR / Admin across organizations get the switcher; the mark follows their pick (both marks for all).
  const canSwitch = !profile.organizationId && (profile.can("PERF_VIEW_ALL") || profile.can("FEEDBACK_REVIEW"));
  const [orgChoices, selectedOrg] = canSwitch ? await Promise.all([getAllScopeOrganizations(), getSelectedOrgId()]) : [[], null];
  const picked = orgChoices.find((o) => o.id === selectedOrg);
  const brand: Brand = canSwitch ? (picked ? brandForOrgCode(picked.code) : "all") : brandForOrgCode(ownOrg);
  const brandProps = {
    brand,
    orgSwitch: canSwitch ? { options: orgChoices.map((o) => ({ id: o.id, name: o.name })), selected: picked?.id ?? null } : undefined,
  };

  return (
    <ToastProvider>
        <AppSidebarLayout
          {...brandProps}
          sections={sections}
          userName={userName}
          userMeta={userMeta}
          userPhoto={userPhoto}
          badges={badges}
          signOut={signOutAction}
          peopleUrl={process.env.PEOPLE_APP_URL?.trim().replace(/\/+$/, "") || undefined}
          switcher={<Switcher />}
          bell={<Suspense fallback={null}><Bell userId={userId} /></Suspense>}
        >
          {children}
        </AppSidebarLayout>
    </ToastProvider>
  );
}
