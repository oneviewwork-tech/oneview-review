import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPeriodValue, formatReviewPeriod } from "@/domain/review/period";
import { getWeeklyScoring } from "@/services/performance/late";
import { todayInIndia } from "@/domain/performance/weeks";

type Db = Prisma.TransactionClient | typeof prisma;

export interface NewNotification {
  userId: string;
  title: string;
  body?: string | null;
  href?: string | null;
  kind?: string | null;
  /** Same key for the same user is only ever stored once. */
  dedupeKey?: string | null;
}

/** Adds notifications; any whose (user, dedupeKey) already exists is skipped. */
export async function notifyInApp(db: Db, items: NewNotification | NewNotification[]) {
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return;
  await db.notification.createMany({
    data: list.map((n) => ({
      userId: n.userId,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
      kind: n.kind ?? null,
      dedupeKey: n.dedupeKey ?? null,
    })),
    skipDuplicates: true,
  });
}

/** The current month only (in India time): earlier months don't appear in the to-do or reminders. */
const monthsInPlay = (now: Date) => {
  const [y, m] = todayInIndia(now).split("-").map(Number);
  return [new Date(Date.UTC(y, m - 1, 1))];
};

export interface TodoItem {
  employeeId: string;
  name: string;
  period: string;
  monthLabel: string;
  /** Weeks so far with no score, in order; the first is the one to score next. */
  weeks: number[];
  /** Of those, the ones whose Saturday has passed. */
  late: number[];
}

/**
 * Everyone this user scores who has a started week without scores this
 * month (a month already submitted counts as done).
 */
export async function getScoringTodo(userId: string, now: Date = new Date()): Promise<TodoItem[]> {
  const mine = await prisma.perfAssignment.findMany({ where: { scorerUserId: userId, employee: { isActive: true } }, select: { employeeId: true } });
  if (mine.length === 0) return [];
  const ids = mine.map((a) => a.employeeId);

  const out = new Map<string, TodoItem>();
  for (const period of monthsInPlay(now)) {
    const weeks = await getWeeklyScoring(ids, {}, null, period, now);
    for (const w of weeks) {
      if (w.upcoming) continue;
      for (const d of w.missing) {
        for (const s of d.scorers) {
          if (s.scorerUserId !== userId) continue;
          for (const p of s.people) {
            const key = `${p.employeeId}|${formatPeriodValue(period)}`;
            const item = out.get(key) ?? {
              employeeId: p.employeeId,
              name: p.name,
              period: formatPeriodValue(period),
              monthLabel: formatReviewPeriod(period),
              weeks: [],
              late: [],
            };
            item.weeks.push(w.week);
            if (w.overdue) item.late.push(w.week);
            out.set(key, item);
          }
        }
      }
    }
  }
  return [...out.values()].sort((a, b) => b.late.length - a.late.length || a.period.localeCompare(b.period) || a.name.localeCompare(b.name));
}

/**
 * Makes sure this scorer has a reminder for every finished week they still
 * owe scores for — one per week, never repeated. Cheap enough to run when
 * their bell loads, so it works without any scheduled job.
 */
export async function syncScoringReminders(userId: string, now: Date = new Date()) {
  const todo = await getScoringTodo(userId, now);
  const byWeek = new Map<string, { period: string; monthLabel: string; week: number; people: TodoItem[] }>();
  for (const t of todo) {
    for (const w of t.late) {
      const key = `${t.period}:w${w}`;
      const g = byWeek.get(key) ?? { period: t.period, monthLabel: t.monthLabel, week: w, people: [] };
      g.people.push(t);
      byWeek.set(key, g);
    }
  }
  await notifyInApp(
    prisma,
    [...byWeek.entries()].map(([key, g]) => ({
      userId,
      kind: "scoring-overdue",
      dedupeKey: `late:${key}`,
      title: `Week ${g.week} of ${g.monthLabel} isn't scored`,
      body:
        g.people.length === 1
          ? `${g.people[0].name} is still waiting for a score.`
          : `${g.people.length} people are still waiting: ${g.people.slice(0, 3).map((p) => p.name).join(", ")}${g.people.length > 3 ? "…" : ""}`,
      href: `/performance/score?employee=${g.people[0].employeeId}&period=${g.period}&week=${g.week}`,
    }))
  );
}

export async function getMyNotifications(userId: string) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, unread };
}
