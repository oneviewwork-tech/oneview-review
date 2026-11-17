import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError, getAccessProfile } from "@/lib/rbac";
import { subtreeOf } from "@/domain/performance/tree";

/**
 * Who may see and score whom, resolved on the server for every request.
 *
 * The scoring tree lives in PerfAssignment (employee -> scorer user). A
 * person's own Employee record is linked to their login by email, which is
 * how the two systems already identify the same human. From that:
 *
 * - a scorer can score the people assigned to them;
 * - anyone can see themselves, and a scorer sees their whole subtree (the
 *   people they score, and whoever those people score in turn);
 * - HR and Admin see everyone; only Admin can score on anyone's behalf.
 */
export interface PerformanceAccess {
  user: Awaited<ReturnType<typeof requireUser>>;
  /** HR or Admin: company-wide visibility and template/assignment setup. */
  isStaff: boolean;
  /** May enter scores for anyone (PERF_SCORE_ANY), acting for their scorer. */
  isAdmin: boolean;
  /** May confirm or send back any submitted month (PERF_DECIDE_ANY). */
  canDecideAny: boolean;
  /** The one organization this person's role is limited to, or null. */
  organizationId: string | null;
  /** The viewer's own Employee row, if their login email matches one. */
  selfEmployeeId: string | null;
  /** Employees this user personally scores. */
  scoredEmployeeIds: string[];
  /**
   * An ordinary employee: not HR/Admin and scoring nobody, so all they have
   * here is their own scorecard and role definition.
   */
  selfOnly: boolean;
  /** Everyone this user may view: themselves plus their subtree (staff: null = all). */
  visibleEmployeeIds: Set<string> | null;
}

export const getPerformanceAccess = cache(async function getPerformanceAccess(): Promise<PerformanceAccess> {
  const profile = await getAccessProfile();
  const user = profile.user;
  const isStaff = profile.can("PERF_VIEW_ALL");

  // Found by either address: the one reviews are mailed to, or the one
  // they sign in with in People (filled by the People refresh).
  // Independent of each other, so asked together: each is a full network hop.
  const [self, scored] = await Promise.all([
    prisma.employee.findFirst({
      where: {
        OR: [
          { email: { equals: user.email, mode: "insensitive" } },
          { peopleEmail: { equals: user.email, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
    prisma.perfAssignment.findMany({
      where: { scorerUserId: user.id },
      select: { employeeId: true },
    }),
  ]);
  const scoredEmployeeIds = scored.map((a) => a.employeeId);

  if (isStaff) {
    // A role pinned to one organization sees only that organization's people.
    const pinned = profile.organizationId
      ? new Set(
          (await prisma.employee.findMany({ where: { organizationId: profile.organizationId }, select: { id: true } })).map((e) => e.id)
        )
      : null;
    if (pinned && self) pinned.add(self.id);
    return {
      user,
      isStaff,
      isAdmin: profile.can("PERF_SCORE_ANY"),
      canDecideAny: profile.can("PERF_DECIDE_ANY"),
      organizationId: profile.organizationId,
      selfEmployeeId: self?.id ?? null,
      scoredEmployeeIds,
      selfOnly: false,
      visibleEmployeeIds: pinned,
    };
  }

  // Walk down the tree: the people I score, then whoever they score.
  const visible = new Set<string>(self ? [self.id] : []);
  if (scoredEmployeeIds.length > 0) {
    const rows = await prisma.perfAssignment.findMany({
      select: {
        employeeId: true,
        scorer: { select: { email: true } },
        employee: { select: { email: true, peopleEmail: true } },
      },
    });
    const edges = rows.map((r) => ({
      employeeId: r.employeeId,
      employeeEmails: [r.employee.email, r.employee.peopleEmail].filter((e): e is string => !!e).map((e) => e.toLowerCase()),
      scorerEmail: r.scorer.email.toLowerCase(),
    }));
    for (const id of subtreeOf(scoredEmployeeIds, edges)) visible.add(id);
  }

  return {
    user,
    isStaff,
    isAdmin: profile.can("PERF_SCORE_ANY"),
    canDecideAny: profile.can("PERF_DECIDE_ANY"),
    organizationId: profile.organizationId,
    selfEmployeeId: self?.id ?? null,
    scoredEmployeeIds,
    selfOnly: scoredEmployeeIds.length === 0,
    visibleEmployeeIds: visible,
  };
});

export function canView(access: PerformanceAccess, employeeId: string): boolean {
  return access.visibleEmployeeIds === null || access.visibleEmployeeIds.has(employeeId);
}

/** Only the assigned scorer — or an Admin acting for them — may enter scores. */
export function canScore(access: PerformanceAccess, employeeId: string): boolean {
  return access.isAdmin || access.scoredEmployeeIds.includes(employeeId);
}

export async function requireStaff() {
  const access = await getPerformanceAccess();
  if (!access.isStaff) throw new ForbiddenError("You don't have permission to see every scorecard.");
  return access;
}
