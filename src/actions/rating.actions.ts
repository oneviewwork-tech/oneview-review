"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { getPerformanceAccess } from "@/services/performance/access";
import { parseReviewPeriod } from "@/domain/review/period";

const input = z.object({
  period: z.string(),
  ratings: z
    .array(
      z.object({
        ratedAs: z.enum(["SCORER", "REVIEWER"]),
        stars: z.number().int().min(1).max(5),
        message: z.string().trim().max(1000).optional(),
      })
    )
    .min(1),
});

/**
 * An employee rates their manager (who scored them) and head (who confirmed
 * the month) for a confirmed month. Who those two are is read from the
 * month itself — never from the request — and each can be rated once per
 * month. The ratings are never shown to the people rated.
 */
export async function rateManagers(raw: unknown): Promise<ActionResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail("Pick 1 to 5 stars.");
  const period = parseReviewPeriod(parsed.data.period);
  if (!period) return fail("That month is not valid.");

  const access = await getPerformanceAccess();
  const me = access.selfEmployeeId;
  if (!me) return fail("Your account isn't linked to an employee record.");

  const review = await prisma.perfReview.findUnique({
    where: { employeeId_period: { employeeId: me, period } },
    select: { status: true, submittedById: true, reviewerUserId: true },
  });
  if (!review || review.status !== "CONFIRMED") return fail("You can rate once your month is confirmed.");

  const targets = {
    SCORER: review.submittedById,
    // The head, if there is one and it isn't the same person as the manager.
    REVIEWER: review.reviewerUserId && review.reviewerUserId !== review.submittedById ? review.reviewerUserId : null,
  };

  let saved = 0;
  for (const r of parsed.data.ratings) {
    const targetUserId = targets[r.ratedAs];
    if (!targetUserId || targetUserId === access.user.id) continue;
    const done = await prisma.managerRating.findUnique({
      where: { raterEmployeeId_period_ratedAs: { raterEmployeeId: me, period, ratedAs: r.ratedAs } },
      select: { id: true },
    });
    if (done) continue; // one rating per month per person — not editable
    await prisma.managerRating.create({
      data: { raterEmployeeId: me, period, ratedAs: r.ratedAs, targetUserId, stars: r.stars, message: r.message || null },
    });
    saved++;
  }
  if (saved === 0) return fail("You've already rated them for this month.");

  revalidatePath(`/performance/people/${me}`);
  return ok(undefined, "Thank you. Your rating has been recorded.");
}
