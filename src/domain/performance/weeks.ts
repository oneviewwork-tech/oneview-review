/**
 * The scoring calendar. A working week runs Monday to Saturday, and a week
 * belongs to the month its Monday falls in — so a month has 4 or 5 weeks
 * (one per Monday) and days before a month's first Monday are the tail of the
 * previous month's last week.
 *
 * Dates are calendar days as "YYYY-MM-DD" strings in India time, the zone
 * everyone works in; comparing those strings compares the days.
 */

export interface ScoringWeek {
  week: number;
  /** Monday. */
  start: string;
  /** Saturday. */
  end: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Today's calendar date in India time. */
export function todayInIndia(now: Date = new Date()): string {
  return iso(new Date(now.getTime() + 5.5 * 60 * 60 * 1000));
}

/** The weeks of a month, `period` being the first of that month (UTC). */
export function weeksOf(period: Date): ScoringWeek[] {
  const y = period.getUTCFullYear();
  const m = period.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const toMonday = (8 - first.getUTCDay()) % 7; // Sunday=0 → 1, Monday=1 → 0
  const out: ScoringWeek[] = [];
  for (let day = 1 + toMonday; new Date(Date.UTC(y, m, day)).getUTCMonth() === m; day += 7) {
    out.push({ week: out.length + 1, start: iso(new Date(Date.UTC(y, m, day))), end: iso(new Date(Date.UTC(y, m, day + 5))) });
  }
  return out;
}

const plusDays = (day: string, n: number) => iso(new Date(Date.parse(day + "T00:00:00Z") + n * 86_400_000));

/** Overdue from the Monday after: Saturday was the day to score it, Sunday is off. */
export const weekOverdue = (w: ScoringWeek, today: string) => plusDays(w.end, 2) <= today;

/** "6–11 Oct" */
export function weekRange(w: ScoringWeek): string {
  const fmt = (s: string, withMonth: boolean) =>
    new Date(s + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", ...(withMonth ? { month: "short" } : {}), timeZone: "UTC" });
  const sameMonth = w.start.slice(0, 7) === w.end.slice(0, 7);
  return `${fmt(w.start, !sameMonth)}–${fmt(w.end, true)}`;
}

/**
 * Why a week can't be scored yet, or null if it can. Weeks go in order: a
 * week can be scored any day, but only once the week before it has scores. A week
 * already scored stays open for corrections.
 */
export function weekLockReason(period: Date, week: number, scoredWeeks: Iterable<number>): string | null {
  const weeks = weeksOf(period);
  const w = weeks.find((x) => x.week === week);
  if (!w) return `This month has ${weeks.length} weeks.`;
  const scored = new Set(scoredWeeks);
  if (scored.has(week)) return null;
  for (let prev = 1; prev < week; prev++) {
    if (!scored.has(prev)) return `Score week ${prev} first.`;
  }
  return null;
}

/** Weeks past their Saturday (counted from the Monday after) with no score, in order. */
export function missedWeeks(period: Date, scoredWeeks: Iterable<number>, today: string): number[] {
  const scored = new Set(scoredWeeks);
  return weeksOf(period)
    .filter((w) => weekOverdue(w, today) && !scored.has(w.week))
    .map((w) => w.week);
}
