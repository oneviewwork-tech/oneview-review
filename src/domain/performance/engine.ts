/**
 * Pure scoring engine for the Performance module — no database, no I/O.
 *
 * It mirrors how HACA's real sheets score today: every KPI carries a maximum
 * number of points (its weight), the scorer awards 0..max points per week,
 * a week's total is the sum, and a month is the average of the weeks that
 * were actually scored. A KPI can alternatively be measured against a
 * target (e.g. "assignment completion >= 85%"), in which case the engine
 * converts the actual into points.
 *
 * Totals are always recomputed from the rows. The source sheets carry
 * hand-typed totals that drift from their own rows (July's run 1-3 points
 * high), so a stored total is never trusted.
 */

export type KpiMode = "RATING" | "TARGET";
export type TargetDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";

export interface KpiDef {
  id: string;
  kraId: string;
  maxPoints: number;
  mode: KpiMode;
  /** TARGET mode only. */
  target?: number;
  direction?: TargetDirection;
}

/** A week's raw entry for one KPI: points for RATING, the measured value for TARGET. */
export type RawScores = Record<string, number | null | undefined>;

export interface KraBreakdown {
  kraId: string;
  points: number;
  maxPoints: number;
}

/**
 * Every scorecard splits into Performance (the first 60% of its points, in
 * scorecard order — 60 of 100) and Potential (the remaining 40%), as HR's
 * sheets do.
 */
export const PERFORMANCE_SHARE = 0.6;
export type Part = "PERFORMANCE" | "POTENTIAL";

export function partsOf(kpis: KpiDef[]): Map<string, Part> {
  const line = kpis.reduce((s, k) => s + k.maxPoints, 0) * PERFORMANCE_SHARE;
  const out = new Map<string, Part>();
  let before = 0;
  for (const k of kpis) {
    // Judged at the KPI's midpoint, so one straddling the line goes to the side most of it is on.
    out.set(k.id, before + k.maxPoints / 2 < line ? "PERFORMANCE" : "POTENTIAL");
    before += k.maxPoints;
  }
  return out;
}

export interface PartScores {
  performance: number;
  potential: number;
  performanceMax: number;
  potentialMax: number;
}

export interface WeekResult {
  total: number;
  maxTotal: number;
  parts: PartScores;
  /** Per KPI points actually awarded; KPIs with no entry are absent. */
  kpiPoints: Record<string, number>;
  kras: KraBreakdown[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Points awarded for one KPI, or null when nothing was entered. */
export function kpiPoints(kpi: KpiDef, raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  if (kpi.mode === "RATING") {
    return Math.min(Math.max(raw, 0), kpi.maxPoints);
  }
  const { target, direction } = kpi;
  if (target == null || direction == null || target <= 0) {
    throw new Error(`KPI ${kpi.id} is TARGET mode but has no valid target/direction`);
  }
  // Achievement is capped at 100%: beating a target earns the full weight,
  // never more than it, so one KPI can't subsidise another.
  const achievement =
    direction === "HIGHER_IS_BETTER" ? raw / target : raw <= 0 ? 1 : target / raw;
  return round(Math.min(Math.max(achievement, 0), 1) * kpi.maxPoints);
}

export function scoreWeek(kpis: KpiDef[], raw: RawScores): WeekResult {
  const kpiPts: Record<string, number> = {};
  const kraMap = new Map<string, KraBreakdown>();
  const partOf = partsOf(kpis);
  const parts: PartScores = { performance: 0, potential: 0, performanceMax: 0, potentialMax: 0 };
  let total = 0;
  let maxTotal = 0;

  for (const kpi of kpis) {
    maxTotal += kpi.maxPoints;
    const kra = kraMap.get(kpi.kraId) ?? { kraId: kpi.kraId, points: 0, maxPoints: 0 };
    kra.maxPoints += kpi.maxPoints;
    const perf = partOf.get(kpi.id) === "PERFORMANCE";
    if (perf) parts.performanceMax += kpi.maxPoints;
    else parts.potentialMax += kpi.maxPoints;
    const pts = kpiPoints(kpi, raw[kpi.id]);
    if (pts != null) {
      kpiPts[kpi.id] = pts;
      kra.points += pts;
      total += pts;
      if (perf) parts.performance += pts;
      else parts.potential += pts;
    }
    kraMap.set(kpi.kraId, kra);
  }

  return {
    total: round(total),
    maxTotal,
    parts: { ...parts, performance: round(parts.performance), potential: round(parts.potential) },
    kpiPoints: kpiPts,
    kras: [...kraMap.values()].map((k) => ({ ...k, points: round(k.points) })),
  };
}

/**
 * Month score: the average of the weeks that have any score. A week with no
 * entries at all (not yet scored) is skipped rather than counted as zero; a
 * week that was scored and earned 0 (e.g. leave) still counts, as in the
 * sheets.
 *
 * Critical KPI deductions for the month then come off that average, as in
 * the sheets: scored 85 with 25 deducted is 60. Never below zero. `base` is
 * the average before deductions.
 */
export function scoreMonth(
  kpis: KpiDef[],
  weeks: RawScores[],
  deduction = 0
): MonthResult {
  const results = weeks.filter((w) => kpis.some((k) => w[k.id] != null)).map((w) => scoreWeek(kpis, w));
  const empty = scoreWeek(kpis, {}).parts;
  if (results.length === 0) {
    return { average: null, base: null, deduction, weeksScored: 0, performance: null, potential: null, performanceMax: empty.performanceMax, potentialMax: empty.potentialMax };
  }
  const avg = (pick: (r: WeekResult) => number) => round(results.reduce((a, r) => a + pick(r), 0) / results.length);
  const base = avg((r) => r.total);
  return {
    average: round(Math.max(0, base - deduction)),
    base,
    deduction,
    weeksScored: results.length,
    performance: avg((r) => r.parts.performance),
    potential: avg((r) => r.parts.potential),
    performanceMax: empty.performanceMax,
    potentialMax: empty.potentialMax,
  };
}

export interface MonthResult {
  /** After critical KPI deductions. */
  average: number | null;
  /** Before deductions. */
  base: number | null;
  deduction: number;
  weeksScored: number;
  /** Month averages of each part (before deductions, which come off the total). */
  performance: number | null;
  potential: number | null;
  performanceMax: number;
  potentialMax: number;
}
