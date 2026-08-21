import { prisma } from "@/lib/prisma";
import { reviewPeriodForDate } from "@/domain/review/period";
import type { UserRole } from "@prisma/client";

/** Counts keyed by the nav href they belong against. */
export type NavBadges = Record<string, number>;

export interface SidebarCycle {
  period: Date;
  /** Employees in scope for this person. */
  total: number;
  /** How many already have feedback this cycle. */
  submitted: number;
  /** Confirmed and waiting to go out — only meaningful for HR/Admin. */
  readyToSend: number;
  /** What the numbers cover: an organization-wide view, or one department. */
  scopeLabel: string;
}

export interface SidebarData {
  badges: NavBadges;
  cycle: SidebarCycle;
}

/**
 * Everything the sidebar shows beyond the links themselves.
 *
 * Badges only appear when there is work, so on a quiet day they say
 * nothing — the cycle summary is the part that is always there, and it is
 * what stops the nav from being a bare list of destinations. Both are
 * gathered in one pass: this runs on every page render, and the database
 * is a region away, so the round trips matter more than the query cost.
 */
export async function getSidebarData(user: {
  id: string;
  role: UserRole;
  departmentId: string | null;
}): Promise<SidebarData> {
  const period = reviewPeriodForDate(new Date());
  const isHr = user.role === "HR" || user.role === "ADMIN";

  // A Department Head only ever sees their own department, here as
  // everywhere else.
  const scope = isHr ? {} : { departmentId: user.departmentId ?? "__none__" };

  const [total, byStatus, needsRevision, department] = await Promise.all([
    prisma.employee.count({ where: { isActive: true, ...scope } }),
    prisma.feedbackSubmission.groupBy({
      by: ["status"],
      where: { reviewPeriod: period, ...scope },
      _count: { _all: true },
    }),
    prisma.feedbackSubmission.count({
      where: { status: "NEEDS_REVISION", departmentHeadId: user.id },
    }),
    user.departmentId
      ? prisma.department.findUnique({ where: { id: user.departmentId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const count = (status: string) => byStatus.find((r) => r.status === status)?._count._all ?? 0;
  const submitted = byStatus.reduce((sum, r) => sum + r._count._all, 0);

  const badges: NavBadges = {};
  // Only ever count work this person can actually clear — a number nobody
  // can act on is noise, not information.
  if (isHr && count("SUBMITTED") > 0) badges["/submissions"] = count("SUBMITTED");
  if (needsRevision > 0) badges["/my-submissions"] = needsRevision;

  return {
    badges,
    cycle: {
      period,
      total,
      submitted,
      readyToSend: isHr ? count("CONFIRMED") : 0,
      scopeLabel: isHr ? "Across all departments" : (department?.name ?? "Your department"),
    },
  };
}
