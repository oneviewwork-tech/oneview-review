import { prisma } from "@/lib/prisma";
import { todayInIndia, weekOverdue, weekRange, weeksOf } from "@/domain/performance/weeks";
import { canEditScores } from "@/domain/performance/workflow";

export interface WeekMissing {
  scorerUserId: string;
  scorerName: string;
  people: { employeeId: string; name: string }[];
}

export interface WeekStatus {
  week: number;
  /** "5–10 Oct" */
  range: string;
  /** Saturday has passed and the Monday after has come: missing scores are late. */
  overdue: boolean;
  /** Not begun yet. */
  upcoming: boolean;
  total: number;
  scored: number;
  /** Who still owes scores for this week, by department, most people first. */
  missing: { department: string; count: number; scorers: WeekMissing[] }[];
  /** Scored / total per department, for the department × week grid. */
  byDepartment: { department: string; total: number; scored: number }[];
}

/**
 * Week-by-week scoring status for a month: for each Mon–Sat week, how many
 * people are scored and, for the rest, which scorer owes them. A month that
 * has been submitted or confirmed counts as complete.
 */
export async function getWeeklyScoring(
  employeeIds: string[] | null,
  scope: { organizationId?: string; departmentId?: string },
  excludeEmployeeId: string | null,
  period: Date,
  now: Date = new Date()
): Promise<WeekStatus[]> {
  const today = todayInIndia(now);
  const [assignments, versions, scored, reviews] = await Promise.all([
    prisma.perfAssignment.findMany({
      where: {
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
        employee: {
          isActive: true,
          ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
          ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        },
      },
      select: {
        employeeId: true,
        templateId: true,
        scorerUserId: true,
        employee: { select: { name: true, department: { select: { name: true } } } },
        scorer: { select: { name: true } },
      },
    }),
    prisma.perfTemplateVersion.findMany({ where: { effectiveFrom: { lte: period } }, select: { templateId: true } }),
    prisma.perfScore.findMany({
      where: { period, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      distinct: ["employeeId", "week"],
      select: { employeeId: true, week: true },
    }),
    prisma.perfReview.findMany({
      where: { period, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
      select: { employeeId: true, status: true },
    }),
  ]);

  const withScorecard = new Set(versions.map((v) => v.templateId));
  const done = new Set(reviews.filter((r) => !canEditScores(r.status)).map((r) => r.employeeId));
  const scoredSet = new Set(scored.map((s) => `${s.employeeId}|${s.week}`));
  const people = assignments.filter((a) => a.employeeId !== excludeEmployeeId && withScorecard.has(a.templateId));

  return weeksOf(period).map((w) => {
    // department -> scorer -> people still to score
    const missingBy = new Map<string, Map<string, WeekMissing>>();
    const depts = new Map<string, { department: string; total: number; scored: number }>();
    let count = 0;
    for (const a of people) {
      const dept = a.employee.department.name;
      const d = depts.get(dept) ?? { department: dept, total: 0, scored: 0 };
      d.total++;
      depts.set(dept, d);
      if (done.has(a.employeeId) || scoredSet.has(`${a.employeeId}|${w.week}`)) {
        count++;
        d.scored++;
        continue;
      }
      const byScorer = missingBy.get(dept) ?? new Map<string, WeekMissing>();
      const m = byScorer.get(a.scorerUserId) ?? { scorerUserId: a.scorerUserId, scorerName: a.scorer.name, people: [] };
      m.people.push({ employeeId: a.employeeId, name: a.employee.name });
      byScorer.set(a.scorerUserId, m);
      missingBy.set(dept, byScorer);
    }
    return {
      week: w.week,
      range: weekRange(w),
      overdue: weekOverdue(w, today),
      upcoming: w.start > today,
      total: people.length,
      scored: count,
      missing: [...missingBy]
        .map(([department, byScorer]) => {
          const scorers = [...byScorer.values()]
            .map((m) => ({ ...m, people: m.people.sort((x, y) => x.name.localeCompare(y.name)) }))
            .sort((a, b) => b.people.length - a.people.length || a.scorerName.localeCompare(b.scorerName));
          return { department, count: scorers.reduce((n, m) => n + m.people.length, 0), scorers };
        })
        .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department)),
      byDepartment: [...depts.values()].sort((a, b) => a.department.localeCompare(b.department)),
    };
  });
}
