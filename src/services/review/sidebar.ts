import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Counts keyed by the nav href they belong against. */
export type NavBadges = Record<string, number>;

/**
 * The little numbers on the menu: work waiting on this person.
 *
 * They only appear when there is something to do, so on a quiet day the menu
 * says nothing. A number nobody can act on is noise, so each count is only
 * ever shown to someone who can clear it:
 *  - HR/Admin: feedback awaiting confirmation;
 *  - a reviewer: performance submissions waiting for their decision (an Admin
 *    can decide any, so sees all);
 *  - a Team Lead: their own feedback and performance submissions sent back.
 *
 * This runs on every page and the database is a network hop away, so it is
 * one statement: the "latest review cycle" lookup is a subquery rather than a
 * round trip of its own. (Review's tables live in the `review` schema, named
 * explicitly because raw SQL can't rely on the connection's search path
 * behind a pooler.)
 */
export async function getNavBadges(user: { id: string; reviewsFeedback: boolean; decidesAny: boolean }): Promise<NavBadges> {
  const isHr = user.reviewsFeedback;
  const isAdmin = user.decidesAny;

  const awaiting = isHr
    ? Prisma.sql`(SELECT count(*)::int FROM "review"."FeedbackSubmission"
                  WHERE "status" = 'SUBMITTED'
                    AND "reviewPeriod" = (SELECT max("reviewPeriod") FROM "review"."FeedbackSubmission"))`
    : Prisma.sql`0`;

  const mineToReview = isAdmin
    ? Prisma.sql`"status" = 'SUBMITTED'`
    : Prisma.sql`"status" = 'SUBMITTED' AND "reviewerUserId" = ${user.id}`;

  const [row] = await prisma.$queryRaw<
    { awaiting: number; revision: number; toReview: number; toFix: number }[]
  >`
    SELECT ${awaiting} AS awaiting,
           (SELECT count(*)::int FROM "review"."FeedbackSubmission"
            WHERE "status" = 'NEEDS_REVISION' AND "departmentHeadId" = ${user.id}) AS revision,
           (SELECT count(*)::int FROM "review"."PerfReview" WHERE ${mineToReview}) AS "toReview",
           (SELECT count(*)::int FROM "review"."PerfReview"
            WHERE "status" = 'NEEDS_REVISION' AND "submittedById" = ${user.id}) AS "toFix"
  `;

  const badges: NavBadges = {};
  if (!row) return badges;
  if (row.awaiting > 0) badges["/submissions"] = row.awaiting;
  if (row.revision > 0) badges["/my-submissions"] = row.revision;
  if (row.toReview > 0) badges["/performance/reviews"] = row.toReview;
  if (row.toFix > 0) badges["/performance/score"] = row.toFix;
  return badges;
}
