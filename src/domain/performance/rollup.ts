/**
 * Rolling individual month scores up into totals for a team, a department or
 * a whole organization.
 *
 * Totals are a share of the maximum (a percentage), never a sum of raw points:
 * scorecards can have different maximums, and a percentage is the only thing
 * that stays comparable across them. A group's score is the mean of its
 * scored people's shares — people not yet scored are counted as people but
 * leave the average alone, so a team doesn't look bad for work not yet done.
 */
export interface RollupRow {
  employeeId: string;
  /** Month average in points, or null when not scored yet. */
  average: number | null;
  maxTotal: number;
  organizationName: string;
  departmentName: string;
  scorerUserId: string;
  scorerName: string;
}

export interface GroupScore {
  key: string;
  label: string;
  /** Everyone in the group. */
  people: number;
  /** Of those, how many have a score. */
  scored: number;
  /** Mean share of maximum, 0-100; null when nobody is scored. */
  percent: number | null;
}

export const percentOf = (r: Pick<RollupRow, "average" | "maxTotal">): number | null =>
  r.average == null || r.maxTotal <= 0 ? null : (r.average / r.maxTotal) * 100;

export function scoreGroup(key: string, label: string, rows: RollupRow[]): GroupScore {
  const shares = rows.map(percentOf).filter((p): p is number => p !== null);
  return {
    key,
    label,
    people: rows.length,
    scored: shares.length,
    percent: shares.length === 0 ? null : Math.round((shares.reduce((a, b) => a + b, 0) / shares.length) * 10) / 10,
  };
}

/** Best score first so strong and weak groups stand out; unscored groups last, then by name. */
export function groupBy(rows: RollupRow[], key: (r: RollupRow) => string, label: (r: RollupRow) => string = key): GroupScore[] {
  const buckets = new Map<string, { label: string; rows: RollupRow[] }>();
  for (const r of rows) {
    const k = key(r);
    const b = buckets.get(k) ?? { label: label(r), rows: [] };
    b.rows.push(r);
    buckets.set(k, b);
  }
  return [...buckets]
    .map(([k, b]) => scoreGroup(k, b.label, b.rows))
    .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.label.localeCompare(b.label));
}

export type ViewerLevel = "organization" | "department" | "team";

/**
 * What a viewer is looking at the total of:
 *  - HR / Admin: the organization (or whatever slice they filtered to);
 *  - someone who scores people who themselves score others: their department;
 *  - someone who only scores individuals: their team.
 */
export function viewerLevel(isStaff: boolean, viewerId: string, rows: Pick<RollupRow, "scorerUserId">[]): ViewerLevel {
  if (isStaff) return "organization";
  return rows.some((r) => r.scorerUserId !== viewerId) ? "department" : "team";
}

/**
 * Average share of each part across the people scored: how the group does on
 * Performance (the first 60) and on Potential (the last 40), each 0-100.
 */
export function partPercents(
  rows: { weeksScored: number; performance: number | null; potential: number | null; performanceMax: number; potentialMax: number }[]
): { performance: number | null; potential: number | null } {
  const mean = (xs: number[]) => (xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10);
  const scored = rows.filter((r) => r.weeksScored > 0);
  return {
    performance: mean(scored.filter((r) => r.performance != null && r.performanceMax > 0).map((r) => (r.performance! / r.performanceMax) * 100)),
    potential: mean(scored.filter((r) => r.potential != null && r.potentialMax > 0).map((r) => (r.potential! / r.potentialMax) * 100)),
  };
}
