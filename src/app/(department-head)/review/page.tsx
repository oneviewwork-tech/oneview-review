import { requireReviewAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ReviewForm } from "@/components/review/review-form";
import { getScopeOrganizations } from "@/services/review/scope";
import { formatReviewPeriod, reviewPeriodForDate, selectablePeriods, formatPeriodValue } from "@/domain/review/period";

export default async function ReviewPage() {
  const { user, departmentId, isAdmin } = await requireReviewAccess();

  // A Team Lead only ever sees their own department's employees. An
  // Admin has no department, so they pick organization then department and
  // the employee list follows — still re-validated server-side on submit.
  const [employees, organizations] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, departmentId: true, organizationId: true, designation: true },
    }),
    isAdmin ? getScopeOrganizations() : Promise.resolve([]),
  ]);

  // Offered rather than inferred: reviews for a month are normally written
  // in the first days of the next one.
  const periods = selectablePeriods(12).map((p) => ({
    value: formatPeriodValue(p),
    label: formatReviewPeriod(p),
  }));

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow={formatReviewPeriod(reviewPeriodForDate(new Date()))}
        title="New Review"
        description={
          isAdmin
            ? "Submit monthly feedback for any employee. Pick a template, write the feedback, and see the exact email before you submit."
            : "Submit monthly feedback for someone in your department. Pick a template, write the feedback, and see the exact email before you submit."
        }
      />
      <ReviewForm
        employees={employees}
        organizations={organizations}
        submitterEmail={user.email}
        periods={periods}
      />
    </div>
  );
}
