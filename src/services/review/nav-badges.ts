import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

/** Counts keyed by the nav href they belong against. */
export type NavBadges = Record<string, number>;

/**
 * Work waiting on the signed-in person, surfaced in the sidebar.
 *
 * The point is that the nav should say where the work is, not just where
 * the pages are: HR can see that three submissions need reading without
 * opening the list, and a Department Head sees when something has been
 * handed back to them.
 *
 * Only ever counts things that need *this* person to act — a number that
 * nobody can clear is noise, not information.
 */
export async function getNavBadges(user: { id: string; role: UserRole }): Promise<NavBadges> {
  const badges: NavBadges = {};

  if (user.role === "HR" || user.role === "ADMIN") {
    const awaitingReview = await prisma.feedbackSubmission.count({ where: { status: "SUBMITTED" } });
    if (awaitingReview > 0) badges["/submissions"] = awaitingReview;
  }

  if (user.role === "DEPARTMENT_HEAD" || user.role === "ADMIN") {
    // Sent back to this person specifically — an Admin sees their own,
    // not everyone's, since the badge means "you have something to fix".
    const needsRevision = await prisma.feedbackSubmission.count({
      where: { status: "NEEDS_REVISION", departmentHeadId: user.id },
    });
    if (needsRevision > 0) badges["/my-submissions"] = needsRevision;
  }

  return badges;
}
