import { prisma } from "@/lib/prisma";
import { reviewPeriodForDate } from "@/domain/review/period";

export interface OverviewCounters {
  period: Date;
  totalEmployees: number;
  submitted: number;
  pending: number;
  confirmed: number;
  sent: number;
}

export interface DepartmentProgress {
  departmentId: string;
  departmentName: string;
  submitted: number;
  totalEmployees: number;
}

/**
 * The three operational questions the HR dashboard must answer immediately
 * (§14).
 *
 * Two queries rather than four separate counts: the database is in
 * Singapore, so every extra round trip is real latency for anyone outside
 * the region. One groupBy returns every status bucket at once, and both
 * queries are issued concurrently.
 */
export async function getOverview(period: Date = reviewPeriodForDate(new Date())): Promise<OverviewCounters> {
  const [totalEmployees, byStatus] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.feedbackSubmission.groupBy({
      by: ["status"],
      where: { reviewPeriod: period },
      _count: { _all: true },
    }),
  ]);

  const count = (status: "SUBMITTED" | "NEEDS_REVISION" | "CONFIRMED" | "SENT") =>
    byStatus.find((r) => r.status === status)?._count._all ?? 0;

  // "Submitted" means "has reached HR at all", so every status counts —
  // including NEEDS_REVISION, which is feedback that exists but is being
  // reworked, not feedback that was never given.
  const submitted = byStatus.reduce((sum, r) => sum + r._count._all, 0);

  return {
    period,
    totalEmployees,
    submitted,
    pending: Math.max(totalEmployees - submitted, 0),
    confirmed: count("CONFIRMED") + count("SENT"),
    sent: count("SENT"),
  };
}

/**
 * Department-level completion for the current period (§16).
 *
 * Counted in Postgres via groupBy instead of fetching every employee and
 * submission row and calling .length on them — the old shape moved one row
 * per employee across the wire just to discard it.
 */
export async function getDepartmentProgress(period: Date = reviewPeriodForDate(new Date())): Promise<DepartmentProgress[]> {
  const [departments, employeeCounts, submissionCounts] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.employee.groupBy({ by: ["departmentId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.feedbackSubmission.groupBy({ by: ["departmentId"], where: { reviewPeriod: period }, _count: { _all: true } }),
  ]);

  const employeesBy = new Map(employeeCounts.map((r) => [r.departmentId, r._count._all]));
  const submissionsBy = new Map(submissionCounts.map((r) => [r.departmentId, r._count._all]));

  return departments.map((d) => ({
    departmentId: d.id,
    departmentName: d.name,
    submitted: submissionsBy.get(d.id) ?? 0,
    totalEmployees: employeesBy.get(d.id) ?? 0,
  }));
}
