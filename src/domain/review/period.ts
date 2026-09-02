/**
 * The review period is the calendar month a submission covers, stored as
 * its first-of-month date (UTC) so it's a stable, comparable/unique key —
 * not the literal submittedAt timestamp, which can drift a day or two from
 * the "official" month once confirmation/sending happens later.
 */
export function reviewPeriodForDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthNameForPeriod(period: Date): string {
  return MONTH_NAMES[period.getUTCMonth()];
}

export function yearForPeriod(period: Date): number {
  return period.getUTCFullYear();
}

/** e.g. "August 2026" — used for the HR dashboard heading (§14). */
export function formatReviewPeriod(period: Date): string {
  return `${monthNameForPeriod(period)} ${yearForPeriod(period)}`;
}

/** "2026-08" — the wire format for a chosen review month. */
export function formatPeriodValue(period: Date): string {
  return `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Parses "YYYY-MM" into a first-of-month UTC date.
 *
 * Returns null for anything malformed or in the future — a review can only
 * ever be about a month that has already started.
 */
export function parseReviewPeriod(value: string, now: Date = new Date()): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  const period = new Date(Date.UTC(year, month - 1, 1));
  if (period > reviewPeriodForDate(now)) return null;
  // A cycle more than a couple of years old is far likelier to be a typo
  // than a genuine backfill.
  if (year < now.getUTCFullYear() - 2) return null;
  return period;
}

/**
 * The months a review may be filed against, most recent first.
 *
 * Feedback for a month is usually written in the first days of the next
 * one, so defaulting to "now" and offering no alternative silently files
 * August's reviews under September.
 */
export function selectablePeriods(count = 12, now: Date = new Date()): Date[] {
  const current = reviewPeriodForDate(now);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - i, 1))
  );
}
