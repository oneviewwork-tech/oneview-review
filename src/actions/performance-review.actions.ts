"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { ForbiddenError, requirePermission } from "@/lib/rbac";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { parseReviewPeriod } from "@/domain/review/period";
import { scoreMonth, type RawScores } from "@/domain/performance/engine";
import { canDecide, canSubmit, mayDecide, periodInPlay, reviewerOf, type ReviewerEdge } from "@/domain/performance/workflow";
import { getPerformanceAccess, canScore } from "@/services/performance/access";
import { getVersionForPeriod, kpiDefsOf, MAX_WEEKS, stateOf } from "@/services/performance/data";
import { monthLabel, notify, revisionEmail, submittedEmail } from "@/services/performance/notifications";
import { runReminders, type ReminderResult } from "@/services/performance/reminders";
import { notifyInApp } from "@/services/notifications/in-app";
import { formatPeriodValue } from "@/domain/review/period";

function refresh(employeeId: string) {
  revalidatePath("/performance", "layout");
  revalidatePath(`/performance/people/${employeeId}`);
}

/** The month's average (after critical KPI deductions) and weeks, computed from what is actually scored. */
async function monthSnapshot(employeeId: string, templateId: string, period: Date) {
  const [version, scores, deduction] = await Promise.all([
    getVersionForPeriod(templateId, period),
    prisma.perfScore.findMany({ where: { employeeId, period }, select: { kpiId: true, week: true, value: true } }),
    prisma.perfPenalty.aggregate({ where: { employeeId, period }, _sum: { points: true } }),
  ]);
  const kpis = version ? kpiDefsOf(version) : [];
  const weeks: RawScores[] = Array.from({ length: MAX_WEEKS }, () => ({}));
  for (const s of scores) weeks[s.week - 1][s.kpiId] = s.value;
  const month = scoreMonth(kpis, weeks, deduction._sum.points ?? 0);
  return { ...month, maxTotal: kpis.reduce((sum, k) => sum + k.maxPoints, 0), hasScorecard: !!version };
}

/**
 * The Team Lead hands a person's month over for review.
 *
 * The reviewer is whoever scores the Team Lead, worked out from the scoring
 * tree right now. If nobody does (the top of the tree), there is nobody to
 * review it and it goes straight to HR as confirmed. Submitting locks the
 * scores until the reviewer decides.
 */
export async function submitMonth(employeeId: string, periodValue: string): Promise<ActionResult> {
  const access = await getPerformanceAccess();
  const period = parseReviewPeriod(periodValue);
  if (!period) return fail("That month is not valid.");
  if (!canScore(access, employeeId)) throw new ForbiddenError("You do not score this person.");

  const [assignment, existing, edges] = await Promise.all([
    prisma.perfAssignment.findUnique({ where: { employeeId }, include: { employee: { select: { name: true } } } }),
    prisma.perfReview.findUnique({ where: { employeeId_period: { employeeId, period } } }),
    prisma.perfAssignment.findMany({
      select: { scorerUserId: true, employee: { select: { email: true, peopleEmail: true } } },
    }),
  ]);
  if (!assignment) return fail("This person has no scorecard assigned yet.");

  const snapshot = await monthSnapshot(employeeId, assignment.templateId, period);
  if (!snapshot.hasScorecard) return fail("No scorecard is in force for that month.");
  const state = stateOf(existing);
  if (!canSubmit(state, snapshot.weeksScored)) {
    return fail(
      snapshot.weeksScored === 0
        ? "Score at least one week before submitting."
        : state === "CONFIRMED"
          ? "This month is already confirmed."
          : "This month is already with the reviewer."
    );
  }

  // The person submitting is the scorer, or an Admin acting for them.
  const scorerUserId = assignment.scorerUserId;
  const scorer = await prisma.user.findUniqueOrThrow({ where: { id: scorerUserId }, select: { id: true, name: true, email: true } });
  const reviewerEdges: ReviewerEdge[] = edges.map((e) => ({
    employeeEmails: [e.employee.email, e.employee.peopleEmail].filter((x): x is string => !!x).map((x) => x.toLowerCase()),
    scorerUserId: e.scorerUserId,
  }));
  const reviewerUserId = reviewerOf(scorer.id, [scorer.email], reviewerEdges);
  const goesStraightToHr = reviewerUserId === null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const data = {
      status: goesStraightToHr ? ("CONFIRMED" as const) : ("SUBMITTED" as const),
      submittedById: access.user.id,
      submittedByName: access.user.name,
      submittedAt: now,
      reviewerUserId,
      // A resubmission starts a fresh round: the old decision and note go.
      decidedById: goesStraightToHr ? access.user.id : null,
      decidedByName: goesStraightToHr ? "No reviewer above, sent straight to HR" : null,
      decidedAt: goesStraightToHr ? now : null,
      revisionNote: null,
      revisionRequestedAt: null,
      finalScore: goesStraightToHr ? snapshot.average : null,
      maxScore: goesStraightToHr ? snapshot.maxTotal : null,
      weeksScored: snapshot.weeksScored,
    };
    await tx.perfReview.upsert({
      where: { employeeId_period: { employeeId, period } },
      create: { employeeId, period, ...data },
      update: data,
    });
    await writeAuditEvent(tx, {
      entityType: "PerfReview",
      entityId: employeeId,
      action: "PERF_REVIEW_SUBMITTED",
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      before: { status: state },
      after: { status: data.status, reviewerUserId },
      metadata: { employeeName: assignment.employee.name, period: monthLabel(period), average: snapshot.average, goesStraightToHr },
    });
  });

  // Tell the reviewer. Best-effort: the submission stands whether or not the email goes.
  if (reviewerUserId) {
    await notifyInApp(prisma, {
      userId: reviewerUserId,
      kind: "review-submitted",
      title: `${scorer.name} submitted ${assignment.employee.name}'s ${monthLabel(period)}`,
      body: "Confirm it, or send it back with a note.",
      href: `/performance/reviews?period=${formatPeriodValue(period)}`,
    }).catch(() => {});
    const reviewer = await prisma.user.findUnique({ where: { id: reviewerUserId }, select: { name: true, email: true, isActive: true } });
    if (reviewer?.isActive) {
      await notify(
        reviewer.email,
        submittedEmail({ reviewerName: reviewer.name, scorerName: scorer.name, employeeName: assignment.employee.name, period, employeeId })
      );
    }
  }

  refresh(employeeId);
  return ok(
    undefined,
    goesStraightToHr
      ? `Submitted. Nobody sits above you, so ${assignment.employee.name}'s ${monthLabel(period)} went straight to HR.`
      : `Submitted ${assignment.employee.name}'s ${monthLabel(period)} for review.`
  );
}

async function loadForDecision(reviewId: string) {
  const access = await getPerformanceAccess();
  const review = await prisma.perfReview.findUnique({
    where: { id: reviewId },
    include: { employee: { select: { id: true, name: true } }, submittedBy: { select: { name: true, email: true, isActive: true } } },
  });
  if (!review) return { access, review: null as null };
  if (!mayDecide({ id: access.user.id, canDecideAny: access.canDecideAny }, review.reviewerUserId)) throw new ForbiddenError("This submission is not yours to review.");
  return { access, review };
}

/** The reviewer approves: the month is final and with HR. */
export async function confirmReview(reviewId: string): Promise<ActionResult> {
  const { access, review } = await loadForDecision(reviewId);
  if (!review) return fail("That submission no longer exists.");
  if (!canDecide(review.status)) return fail("This submission is not waiting for review.");

  const assignment = await prisma.perfAssignment.findUnique({ where: { employeeId: review.employeeId } });
  const snapshot = assignment ? await monthSnapshot(review.employeeId, assignment.templateId, review.period) : null;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.perfReview.update({
      where: { id: review.id },
      data: {
        status: "CONFIRMED",
        decidedById: access.user.id,
        decidedByName: access.user.name,
        decidedAt: now,
        revisionNote: null,
        revisionRequestedAt: null,
        // Frozen now, so a later scorecard edit can't change what HR received.
        finalScore: snapshot?.average ?? null,
        maxScore: snapshot?.maxTotal ?? null,
        weeksScored: snapshot?.weeksScored ?? review.weeksScored,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "PerfReview",
      entityId: review.employeeId,
      action: "PERF_REVIEW_CONFIRMED",
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      before: { status: review.status },
      after: { status: "CONFIRMED", finalScore: snapshot?.average ?? null },
      metadata: { employeeName: review.employee.name, period: monthLabel(review.period) },
    });
  });

  await notifyInApp(prisma, {
    userId: review.submittedById,
    kind: "review-confirmed",
    title: `${access.user.name} confirmed ${review.employee.name}'s ${monthLabel(review.period)}`,
    body: "It's final and with HR.",
    href: `/performance/people/${review.employeeId}?period=${formatPeriodValue(review.period)}`,
  }).catch(() => {});

  refresh(review.employeeId);
  return ok(undefined, `Confirmed ${review.employee.name}'s ${monthLabel(review.period)}. It is now with HR.`);
}

/** The reviewer sends it back to the Team Lead with a note saying what to fix. */
export async function requestRevision(reviewId: string, note: string): Promise<ActionResult> {
  const trimmed = note.trim();
  if (trimmed.length < 5) return fail("Tell them what to change (a few words at least).");
  if (trimmed.length > 1000) return fail("That note is too long; keep it under 1000 characters.");

  const { access, review } = await loadForDecision(reviewId);
  if (!review) return fail("That submission no longer exists.");
  if (!canDecide(review.status)) return fail("This submission is not waiting for review.");
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.perfReview.update({
      where: { id: review.id },
      data: {
        status: "NEEDS_REVISION",
        decidedById: access.user.id,
        decidedByName: access.user.name,
        decidedAt: now,
        revisionNote: trimmed,
        revisionRequestedAt: now,
        finalScore: null,
        maxScore: null,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "PerfReview",
      entityId: review.employeeId,
      action: "PERF_REVIEW_REVISION_REQUESTED",
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      before: { status: review.status },
      after: { status: "NEEDS_REVISION" },
      metadata: { employeeName: review.employee.name, period: monthLabel(review.period), note: trimmed },
    });
  });

  await notifyInApp(prisma, {
    userId: review.submittedById,
    kind: "review-revision",
    title: `${access.user.name} sent back ${review.employee.name}'s ${monthLabel(review.period)}`,
    body: trimmed,
    href: `/performance/score?employee=${review.employeeId}&period=${formatPeriodValue(review.period)}`,
  }).catch(() => {});

  if (review.submittedBy.isActive) {
    await notify(
      review.submittedBy.email,
      revisionEmail({
        scorerName: review.submittedBy.name,
        reviewerName: access.user.name,
        employeeName: review.employee.name,
        period: review.period,
        note: trimmed,
        employeeId: review.employeeId,
      })
    );
  }

  refresh(review.employeeId);
  return ok(undefined, `Sent back to ${review.submittedByName} with your note.`);
}

/** HR/Admin: email everyone who still owes a submission or a review. */
export async function sendReminders(periodValue?: string): Promise<ActionResult<ReminderResult>> {
  const { user } = await requirePermission("PERF_SEND_REMINDERS");
  const period = (periodValue && parseReviewPeriod(periodValue)) || periodInPlay(new Date());
  const result = await runReminders(period, { id: user.id, email: user.email });
  revalidatePath("/performance", "layout");

  if (result.sent === 0 && result.skippedRecently === 0 && result.failed.length === 0) {
    return ok(result, `Nobody needs a reminder for ${monthLabel(period)}.`);
  }
  const parts = [`Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"}`];
  if (result.skippedRecently > 0) parts.push(`${result.skippedRecently} skipped (reminded in the last day)`);
  if (result.failed.length > 0) parts.push(`${result.failed.length} failed`);
  return ok(result, `${parts.join(", ")} for ${monthLabel(period)}.`);
}
