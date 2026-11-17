import type { UserRole } from "@prisma/client";

/**
 * The monthly approval workflow for a person's scores:
 *
 *   Team Lead enters scores (DRAFT)
 *     -> submits the month               (SUBMITTED, with the Department Head)
 *     -> Department Head confirms        (CONFIRMED, final, with HR)
 *        or sends it back with a note    (NEEDS_REVISION, back to the Team Lead)
 *     -> Team Lead fixes and resubmits   (SUBMITTED again)
 *
 * DRAFT has no database row; the other three live in PerfReview.status. All
 * the rules are here, pure, so they can be tested without a database.
 */
export type ReviewState = "DRAFT" | "SUBMITTED" | "NEEDS_REVISION" | "CONFIRMED";

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting review",
  NEEDS_REVISION: "Needs revision",
  CONFIRMED: "Confirmed",
};

/** Scores can only be changed while the Team Lead holds the pen. */
export const canEditScores = (state: ReviewState): boolean => state === "DRAFT" || state === "NEEDS_REVISION";

/** Submitting needs something to submit: at least one scored week. */
export const canSubmit = (state: ReviewState, weeksScored: number): boolean => canEditScores(state) && weeksScored > 0;

/** Only a submission that is waiting can be confirmed or sent back. */
export const canDecide = (state: ReviewState): boolean => state === "SUBMITTED";

/**
 * Whether a viewer may see a month's actual scores.
 *
 * Someone viewing only their own scorecard — an employee who scores nobody —
 * sees their scores once the month is CONFIRMED, not before. Draft and
 * in-review numbers aren't final and can still be changed or sent back, and
 * showing them invites disputes over figures that were never settled. Until
 * then they still see the scorecard itself (what they are measured on). Anyone
 * who scores or reviews people always sees the working numbers.
 */
export const mayViewScores = (viewerIsSelfOnly: boolean, state: ReviewState): boolean =>
  !viewerIsSelfOnly || state === "CONFIRMED";

/** True while the ball is in the Team Lead's court (they owe HR a submission). */
export const awaitingScorer = canEditScores;

export interface ReviewerEdge {
  /** Every address the scored person is known by (lower-cased). */
  employeeEmails: string[];
  /** Who scores them. */
  scorerUserId: string;
}

/**
 * Who reviews a Team Lead's submissions: whoever scores the Team Lead.
 *
 * `scorerEmails` are the Team Lead's own addresses. Null when nobody scores
 * them (nobody sits above), or when the only match is themselves — a person
 * never reviews their own submission. A null reviewer means the submission
 * goes straight to HR.
 */
export function reviewerOf(scorerUserId: string, scorerEmails: string[], edges: ReviewerEdge[]): string | null {
  const wanted = new Set(scorerEmails.map((e) => e.toLowerCase()));
  const above = edges.find((e) => e.employeeEmails.some((x) => wanted.has(x.toLowerCase())));
  if (!above || above.scorerUserId === scorerUserId) return null;
  return above.scorerUserId;
}

/** Admin may decide anything; otherwise only the named reviewer may. */
/** The reviewer decides; so does anyone whose role grants "confirm any month" (canDecideAny). */
export function mayDecide(actor: { id: string; canDecideAny?: boolean }, reviewerUserId: string | null): boolean {
  return !!actor.canDecideAny || (reviewerUserId !== null && actor.id === reviewerUserId);
}

/**
 * The month a reminder is about. In the first days of a month the work in
 * hand is still last month's submission, so reminders look back; after that
 * they are about the current month.
 */
export function periodInPlay(now: Date): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return now.getUTCDate() <= 5 ? new Date(Date.UTC(y, m - 1, 1)) : new Date(Date.UTC(y, m, 1));
}

export interface PendingScoring {
  employeeId: string;
  name: string;
  scorerUserId: string;
  state: ReviewState;
  revisionNote: string | null;
  weeksScored: number;
}

/** Reminders owed to Team Leads: everyone of theirs still in DRAFT or sent back, grouped by Team Lead. */
export function pendingByScorer(people: PendingScoring[]): Map<string, PendingScoring[]> {
  const out = new Map<string, PendingScoring[]>();
  for (const p of people) {
    if (!awaitingScorer(p.state)) continue;
    out.set(p.scorerUserId, [...(out.get(p.scorerUserId) ?? []), p]);
  }
  return out;
}

/** Reminders owed to reviewers: submissions waiting on them, grouped by reviewer. Unassigned ones are HR's. */
export function waitingByReviewer(reviews: { reviewerUserId: string | null; name: string }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of reviews) {
    if (!r.reviewerUserId) continue;
    out.set(r.reviewerUserId, [...(out.get(r.reviewerUserId) ?? []), r.name]);
  }
  return out;
}
