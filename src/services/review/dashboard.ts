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

/** The three operational questions the HR dashboard must answer immediately (§14). */
export async function getOverview(period: Date = reviewPeriodForDate(new Date())): Promise<OverviewCounters> {
  const [totalEmployees, submitted, confirmedOrSent, sent] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.feedbackSubmission.count({ where: { reviewPeriod: period } }),
    prisma.feedbackSubmission.count({ where: { reviewPeriod: period, status: { in: ["CONFIRMED", "SENT"] } } }),
    prisma.feedbackSubmission.count({ where: { reviewPeriod: period, status: "SENT" } }),
  ]);

  return {
    period,
    totalEmployees,
    submitted,
    pending: Math.max(totalEmployees - submitted, 0),
    confirmed: confirmedOrSent,
    sent,
  };
}

/** Department-level completion for the current period (§16). */
export async function getDepartmentProgress(period: Date = reviewPeriodForDate(new Date())): Promise<DepartmentProgress[]> {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      employees: { where: { isActive: true }, select: { id: true } },
      submissions: { where: { reviewPeriod: period }, select: { id: true } },
    },
  });

  return departments.map((d) => ({
    departmentId: d.id,
    departmentName: d.name,
    submitted: d.submissions.length,
    totalEmployees: d.employees.length,
  }));
}
