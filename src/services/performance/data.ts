import { prisma } from "@/lib/prisma";
import { scoreWeek, scoreMonth, type KpiDef, type RawScores, type MonthResult } from "@/domain/performance/engine";
import type { PerfReviewStatus, Prisma } from "@prisma/client";
import type { ReviewState } from "@/domain/performance/workflow";

export const MAX_WEEKS = 5;

const versionInclude = {
  kras: { orderBy: { sortOrder: "asc" }, include: { kpis: { orderBy: { sortOrder: "asc" } } } },
  risks: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.PerfTemplateVersionInclude;

export type LoadedVersion = Prisma.PerfTemplateVersionGetPayload<{ include: typeof versionInclude }>;

/**
 * The version of a template in force for a month: the latest one whose
 * effectiveFrom is on or before it. A month before the first version has
 * no scorecard yet.
 */
export async function getVersionForPeriod(templateId: string, period: Date): Promise<LoadedVersion | null> {
  return prisma.perfTemplateVersion.findFirst({
    where: { templateId, effectiveFrom: { lte: period } },
    orderBy: { effectiveFrom: "desc" },
    include: versionInclude,
  });
}

export function kpiDefsOf(version: LoadedVersion): KpiDef[] {
  return version.kras.flatMap((kra) =>
    kra.kpis.map((k) => ({
      id: k.id,
      kraId: kra.id,
      maxPoints: k.maxPoints,
      mode: k.mode,
      target: k.target ?? undefined,
      direction: k.direction ?? undefined,
    }))
  );
}

export interface PersonPerformance {
  employee: { id: string; name: string; email: string; designation: string | null; departmentName: string };
  template: { id: string; name: string; roleDefinition: string | null; responsibilities: string | null };
  scorer: { id: string; name: string };
  /** Who will review the month once submitted; null when it goes straight to HR. */
  expectedReviewerName: string | null;
  version: LoadedVersion | null;
  /** week (1-based) -> kpiId -> entry */
  entries: Map<number, Map<string, { value: number; remark: string | null }>>;
  weekTotals: Map<number, { total: number; maxTotal: number }>;
  /** average is after critical KPI deductions; base is before. */
  month: MonthResult;
  /** Critical KPI deductions this month: riskId -> entry. */
  penalties: Map<string, { points: number; remark: string | null }>;
  maxTotal: number;
  /** Where the month's approval has got to; null while still a draft. */
  review: ReviewInfo | null;
  reviewState: ReviewState;
}

export interface ReviewInfo {
  id: string;
  status: PerfReviewStatus;
  submittedByName: string;
  submittedAt: Date;
  reviewerUserId: string | null;
  reviewerName: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  revisionNote: string | null;
  finalScore: number | null;
  maxScore: number | null;
  weeksScored: number | null;
}

export const stateOf = (review: { status: PerfReviewStatus } | null): ReviewState => review?.status ?? "DRAFT";

export async function getPersonPerformance(employeeId: string, period: Date): Promise<PersonPerformance | null> {
  const assignment = await prisma.perfAssignment.findUnique({
    where: { employeeId },
    include: {
      template: true,
      scorer: { select: { id: true, name: true, email: true } },
      employee: {
        select: { id: true, name: true, email: true, designation: true, department: { select: { name: true } } },
      },
    },
  });
  if (!assignment) return null;

  // Independent once the assignment is known, so asked together.
  const [version, scores, penaltyRows, reviewRow, above] = await Promise.all([
    getVersionForPeriod(assignment.templateId, period),
    prisma.perfScore.findMany({ where: { employeeId, period } }),
    prisma.perfPenalty.findMany({ where: { employeeId, period }, select: { riskId: true, points: true, remark: true } }),
    prisma.perfReview.findUnique({
      where: { employeeId_period: { employeeId, period } },
      include: { reviewer: { select: { name: true } } },
    }),
    // Whoever scores this person's scorer is who will review the month.
    prisma.perfAssignment.findFirst({
      where: {
        scorerUserId: { not: assignment.scorerUserId },
        employee: {
          OR: [
            { email: { equals: assignment.scorer.email, mode: "insensitive" } },
            { peopleEmail: { equals: assignment.scorer.email, mode: "insensitive" } },
          ],
        },
      },
      select: { scorer: { select: { name: true } } },
    }),
  ]);
  const review: ReviewInfo | null = reviewRow
    ? {
        id: reviewRow.id,
        status: reviewRow.status,
        submittedByName: reviewRow.submittedByName,
        submittedAt: reviewRow.submittedAt,
        reviewerUserId: reviewRow.reviewerUserId,
        reviewerName: reviewRow.reviewer?.name ?? null,
        decidedByName: reviewRow.decidedByName,
        decidedAt: reviewRow.decidedAt,
        revisionNote: reviewRow.revisionNote,
        finalScore: reviewRow.finalScore,
        maxScore: reviewRow.maxScore,
        weeksScored: reviewRow.weeksScored,
      }
    : null;

  const entries: PersonPerformance["entries"] = new Map();
  for (const s of scores) {
    const week = entries.get(s.week) ?? new Map();
    week.set(s.kpiId, { value: s.value, remark: s.remark });
    entries.set(s.week, week);
  }

  const kpis = version ? kpiDefsOf(version) : [];
  const weeks: RawScores[] = [];
  const weekTotals: PersonPerformance["weekTotals"] = new Map();
  for (let w = 1; w <= MAX_WEEKS; w++) {
    const raw: RawScores = {};
    entries.get(w)?.forEach((v, kpiId) => (raw[kpiId] = v.value));
    weeks.push(raw);
    if (Object.keys(raw).length > 0) {
      const r = scoreWeek(kpis, raw);
      weekTotals.set(w, { total: r.total, maxTotal: r.maxTotal });
    }
  }

  return {
    employee: {
      id: assignment.employee.id,
      name: assignment.employee.name,
      email: assignment.employee.email,
      designation: assignment.employee.designation,
      departmentName: assignment.employee.department.name,
    },
    template: {
      id: assignment.template.id,
      name: assignment.template.name,
      roleDefinition: assignment.template.roleDefinition,
      responsibilities: assignment.template.responsibilities,
    },
    scorer: { id: assignment.scorer.id, name: assignment.scorer.name },
    expectedReviewerName: above?.scorer.name ?? null,
    version,
    entries,
    weekTotals,
    month: scoreMonth(kpis, weeks, penaltyRows.reduce((sum, p) => sum + p.points, 0)),
    penalties: new Map(penaltyRows.map((p) => [p.riskId, { points: p.points, remark: p.remark }])),
    maxTotal: kpis.reduce((s, k) => s + k.maxPoints, 0),
    review,
    reviewState: stateOf(review),
  };
}

export interface TeamRow {
  employeeId: string;
  name: string;
  designation: string | null;
  /** False once they have left (only returned when leavers are asked for). */
  isActive: boolean;
  departmentName: string;
  templateName: string;
  scorerName: string;
  organizationName: string;
  scorerUserId: string;
  reviewState: ReviewState;
  reviewId: string | null;
  reviewerUserId: string | null;
  reviewerName: string | null;
  submittedAt: Date | null;
  revisionNote: string | null;
  weeksScored: number;
  average: number | null;
  maxTotal: number;
  lastWeekTotal: number | null;
  /** Month averages of the two parts of the scorecard (60 / 40). */
  performance: number | null;
  potential: number | null;
  performanceMax: number;
  potentialMax: number;
}

/**
 * Dashboards and reports show a score only once its month is confirmed: a
 * draft or a month still with the reviewer may yet change. Progress (weeks
 * scored, status) stays; the numbers are blanked. Scorers and reviewers see
 * the live numbers where they work — Score Team, the person's page, Reviews.
 */
export function confirmedScoresOnly(rows: TeamRow[]): TeamRow[] {
  return rows.map((r) =>
    r.reviewState === "CONFIRMED" ? r : { ...r, average: null, performance: null, potential: null, lastWeekTotal: null }
  );
}

/** Which assignments are in view: the people allowed, narrowed to an organization and/or department. */
function assignmentWhere(
  employeeIds: string[] | null,
  scope: { organizationId?: string; departmentId?: string; includeLeavers?: boolean }
): Prisma.PerfAssignmentWhereInput {
  // People who have left are not shown: their past scores stay in the record,
  // but they drop out of every team, total and list — except where a page
  // asks for them (the month-by-month history shows leavers, struck through).
  return {
    ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
    employee: {
      ...(scope.includeLeavers ? {} : { isActive: true }),
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    },
  };
}

/**
 * Summary rows for a set of employees (null = everyone with an assignment),
 * optionally narrowed to one organization and/or department — the filters HR
 * and Admin get on every list.
 */
export async function getTeamRows(
  employeeIds: string[] | null,
  period: Date,
  scope: { organizationId?: string; departmentId?: string; includeLeavers?: boolean } = {}
): Promise<TeamRow[]> {
  // One round trip deep, not three: the database is far away, so each
  // sequential query costs a full network hop. Versions, scores and reviews
  // are small (a handful of scorecards, one month of data), so fetching them
  // for everyone and picking in memory beats asking per template or person.
  const [assignments, versionRows, scores, reviews, penalties] = await Promise.all([
    prisma.perfAssignment.findMany({
      where: assignmentWhere(employeeIds, scope),
      include: {
        template: { select: { id: true, name: true } },
        scorer: { select: { name: true } },
        employee: {
          select: {
            id: true,
            name: true,
            designation: true,
            isActive: true,
            department: { select: { name: true } },
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: [{ employee: { name: "asc" } }],
    }),
    prisma.perfTemplateVersion.findMany({
      where: { effectiveFrom: { lte: period } },
      orderBy: { effectiveFrom: "desc" },
      include: versionInclude,
    }),
    prisma.perfScore.findMany({
      where: { period, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      select: { employeeId: true, kpiId: true, week: true, value: true },
    }),
    prisma.perfReview.findMany({
      where: { period, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      select: {
        id: true,
        employeeId: true,
        status: true,
        reviewerUserId: true,
        reviewer: { select: { name: true } },
        submittedByName: true,
        submittedAt: true,
        revisionNote: true,
        finalScore: true,
      },
    }),
    prisma.perfPenalty.groupBy({
      by: ["employeeId"],
      where: { period, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      _sum: { points: true },
    }),
  ]);
  if (assignments.length === 0) return [];
  const deductionBy = new Map(penalties.map((p) => [p.employeeId, p._sum.points ?? 0]));
  const reviewByEmployee = new Map(reviews.map((r) => [r.employeeId, r]));

  // Newest first, so the first version seen per template is the one in force.
  const versions = new Map<string, LoadedVersion | null>();
  for (const v of versionRows) if (!versions.has(v.templateId)) versions.set(v.templateId, v);
  const byEmployee = new Map<string, RawScores[]>();
  for (const s of scores) {
    const weeks = byEmployee.get(s.employeeId) ?? Array.from({ length: MAX_WEEKS }, () => ({}) as RawScores);
    weeks[s.week - 1][s.kpiId] = s.value;
    byEmployee.set(s.employeeId, weeks);
  }

  return assignments.map((a) => {
    const version = versions.get(a.templateId) ?? null;
    const kpis = version ? kpiDefsOf(version) : [];
    const weeks = byEmployee.get(a.employeeId) ?? [];
    const month = scoreMonth(kpis, weeks, deductionBy.get(a.employeeId) ?? 0);
    const scoredWeeks = weeks.map((w, i) => ({ i, w })).filter(({ w }) => kpis.some((k) => w[k.id] != null));
    const last = scoredWeeks.at(-1);
    const review = reviewByEmployee.get(a.employeeId) ?? null;
    return {
      employeeId: a.employeeId,
      name: a.employee.name,
      designation: a.employee.designation,
      isActive: a.employee.isActive,
      departmentName: a.employee.department.name,
      organizationName: a.employee.organization.name,
      templateName: a.template.name,
      scorerName: a.scorer.name,
      scorerUserId: a.scorerUserId,
      reviewState: stateOf(review),
      reviewId: review?.id ?? null,
      reviewerUserId: review?.reviewerUserId ?? null,
      reviewerName: review?.reviewer?.name ?? null,
      submittedAt: review?.submittedAt ?? null,
      revisionNote: review?.revisionNote ?? null,
      weeksScored: month.weeksScored,
      // A confirmed month is shown as it was when HR received it, even if the
      // scorecard has been edited since.
      average: review?.status === "CONFIRMED" && review.finalScore != null ? review.finalScore : month.average,
      maxTotal: kpis.reduce((s, k) => s + k.maxPoints, 0),
      lastWeekTotal: last ? scoreWeek(kpis, last.w).total : null,
      performance: month.performance,
      potential: month.potential,
      performanceMax: month.performanceMax,
      potentialMax: month.potentialMax,
    };
  });
}

export interface KraScore {
  key: string;
  /** The KRA's name, e.g. "Process Compliance & Reporting". */
  label: string;
  /** The scorecard it belongs to — the same KRA name can appear on several. */
  scorecard: string;
  /** How many people contribute to it. */
  people: number;
  /** Mean share of the KRA's maximum across those people, 0-100. */
  percent: number;
  /** The KRA's maximum points, so the share can be shown as points. */
  max: number;
}

/**
 * How each KRA is doing across everyone in scope, weakest first.
 *
 * This is the "why" behind a low total: not "Team B is at 71%" but
 * "Attendance Monitoring is low in every SHO team". A KRA is only compared
 * within its own scorecard, since different scorecards weight and name their
 * KRAs differently. Computed with the same engine as every other score.
 */
export async function getKraRollup(
  employeeIds: string[] | null,
  period: Date,
  scope: { organizationId?: string; departmentId?: string } = {}
): Promise<KraScore[]> {
  // Confirmed months only, like every other number on the dashboard.
  const [assignments, versionRows, scores] = await Promise.all([
    prisma.perfAssignment.findMany({
      where: {
        ...assignmentWhere(employeeIds, scope),
        employee: { ...(assignmentWhere(employeeIds, scope).employee as object), perfReviews: { some: { period, status: "CONFIRMED" } } },
      },
      select: { employeeId: true, templateId: true, template: { select: { name: true } } },
    }),
    prisma.perfTemplateVersion.findMany({
      where: { effectiveFrom: { lte: period } },
      orderBy: { effectiveFrom: "desc" },
      include: versionInclude,
    }),
    prisma.perfScore.findMany({
      where: { period, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      select: { employeeId: true, kpiId: true, week: true, value: true },
    }),
  ]);

  const versions = new Map<string, LoadedVersion>();
  for (const v of versionRows) if (!versions.has(v.templateId)) versions.set(v.templateId, v);

  const weeksBy = new Map<string, RawScores[]>();
  for (const s of scores) {
    const weeks = weeksBy.get(s.employeeId) ?? Array.from({ length: MAX_WEEKS }, () => ({}) as RawScores);
    weeks[s.week - 1][s.kpiId] = s.value;
    weeksBy.set(s.employeeId, weeks);
  }

  const buckets = new Map<string, { label: string; scorecard: string; max: number; shares: number[] }>();
  for (const a of assignments) {
    const version = versions.get(a.templateId);
    const weeks = weeksBy.get(a.employeeId);
    if (!version || !weeks) continue;
    const kpis = kpiDefsOf(version);
    const scoredWeeks = weeks.filter((w) => kpis.some((k) => w[k.id] != null));
    if (scoredWeeks.length === 0) continue;

    const names = new Map(version.kras.map((k) => [k.id, k.name]));
    const maxOf = new Map(version.kras.map((k) => [k.id, k.kpis.reduce((n, p) => n + p.maxPoints, 0)]));
    const perKra = new Map<string, number[]>();
    for (const w of scoredWeeks) {
      for (const kra of scoreWeek(kpis, w).kras) {
        if (kra.maxPoints <= 0) continue;
        perKra.set(kra.kraId, [...(perKra.get(kra.kraId) ?? []), (kra.points / kra.maxPoints) * 100]);
      }
    }
    for (const [kraId, shares] of perKra) {
      const label = names.get(kraId) ?? "KRA";
      const key = `${a.template.name}|${label}`;
      const b = buckets.get(key) ?? { label, scorecard: a.template.name, max: maxOf.get(kraId) ?? 0, shares: [] };
      b.shares.push(shares.reduce((x, y) => x + y, 0) / shares.length);
      buckets.set(key, b);
    }
  }

  return [...buckets]
    .map(([key, b]) => ({
      key,
      label: b.label,
      scorecard: b.scorecard,
      people: b.shares.length,
      max: b.max,
      percent: Math.round((b.shares.reduce((x, y) => x + y, 0) / b.shares.length) * 10) / 10,
    }))
    .sort((a, b) => a.percent - b.percent || a.label.localeCompare(b.label));
}
