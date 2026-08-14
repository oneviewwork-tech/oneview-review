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
