import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { pendingByScorer, waitingByReviewer, type PendingScoring } from "@/domain/performance/workflow";
import { getTeamRows } from "@/services/performance/data";
import { monthLabel, notify, reviewerReminderEmail, scorerReminderEmail } from "@/services/performance/notifications";

/** Don't nudge the same person twice in a day, however many times "send" is pressed. */
const COOLDOWN_MS = 20 * 60 * 60 * 1000;

export interface ReminderResult {
  period: string;
  sent: number;
  skippedRecently: number;
  failed: { name: string; error: string }[];
  scorers: number;
  reviewers: number;
}

/**
 * Emails Team Leads who still owe a submission (people in draft or sent
 * back) and reviewers with submissions waiting. Safe to call repeatedly:
 * anyone reminded in the last 20 hours is skipped. Used by the HR button and
 * by the weekly scheduled job.
 */
export async function runReminders(period: Date, actor: { id: string; email: string } | null): Promise<ReminderResult> {
  const [rows, waiting] = await Promise.all([
    getTeamRows(null, period),
    prisma.perfReview.findMany({
      where: { period, status: "SUBMITTED" },
      select: { reviewerUserId: true, employee: { select: { name: true } } },
    }),
  ]);

  const scorerPlan = pendingByScorer(
    rows.map<PendingScoring>((r) => ({
      employeeId: r.employeeId,
      name: r.name,
      scorerUserId: r.scorerUserId,
      state: r.reviewState,
      revisionNote: r.revisionNote,
      weeksScored: r.weeksScored,
    }))
  );
  const reviewerPlan = waitingByReviewer(waiting.map((w) => ({ reviewerUserId: w.reviewerUserId, name: w.employee.name })));

  const userIds = [...new Set([...scorerPlan.keys(), ...reviewerPlan.keys()])];
  if (userIds.length === 0) return { period: period.toISOString().slice(0, 7), sent: 0, skippedRecently: 0, failed: [], scorers: 0, reviewers: 0 };

  const [users, recent] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds }, isActive: true }, select: { id: true, name: true, email: true } }),
    prisma.auditEvent.findMany({
      where: { action: "PERF_REMINDER_SENT", entityId: { in: userIds }, createdAt: { gt: new Date(Date.now() - COOLDOWN_MS) } },
      select: { entityId: true },
    }),
  ]);
  const recentlyReminded = new Set(recent.map((r) => r.entityId));

  const result: ReminderResult = { period: period.toISOString().slice(0, 7), sent: 0, skippedRecently: 0, failed: [], scorers: 0, reviewers: 0 };

  for (const user of users) {
    if (recentlyReminded.has(user.id)) {
      result.skippedRecently++;
      continue;
    }

    // One email per person: a Team Lead who is also someone's reviewer gets
    // their two lists in separate emails, but only one reminder run.
    const jobs: { kind: "scorer" | "reviewer"; count: number; email: ReturnType<typeof scorerReminderEmail> }[] = [];

    const owed = scorerPlan.get(user.id);
    if (owed?.length) {
      jobs.push({
        kind: "scorer",
        count: owed.length,
        email: scorerReminderEmail({
          period,
          people: owed.map((p) => ({
            name: p.name,
            detail:
              p.state === "NEEDS_REVISION"
                ? `sent back${p.revisionNote ? `: ${p.revisionNote}` : ""}`
                : p.weeksScored > 0
                  ? `${p.weeksScored} week${p.weeksScored === 1 ? "" : "s"} scored, not submitted`
                  : "not scored yet",
          })),
        }),
      });
    }
    const queue = reviewerPlan.get(user.id);
    if (queue?.length) jobs.push({ kind: "reviewer", count: queue.length, email: reviewerReminderEmail({ period, names: queue }) });

    let any = false;
    for (const job of jobs) {
      const sent = await notify(user.email, job.email);
      if (sent.ok) {
        any = true;
        result.sent++;
        if (job.kind === "scorer") result.scorers++;
        else result.reviewers++;
      } else {
        result.failed.push({ name: user.name, error: sent.error ?? "Unknown error" });
      }
    }
    if (any) {
      await writeAuditEvent(prisma, {
        entityType: "PerfReminder",
        entityId: user.id,
        action: "PERF_REMINDER_SENT",
        actorUserId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        metadata: { period: monthLabel(period), kinds: jobs.map((j) => `${j.kind}:${j.count}`), trigger: actor ? "manual" : "scheduled" },
      });
    }
  }
  return result;
}
