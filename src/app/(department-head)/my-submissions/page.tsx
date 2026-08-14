import { requireDepartmentHead } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatReviewPeriod } from "@/domain/review/period";

export default async function MySubmissionsPage() {
  const { user } = await requireDepartmentHead();

  const submissions = await prisma.feedbackSubmission.findMany({
    where: { departmentHeadId: user.id },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-page-title">My Submissions</h1>
      <p className="text-page-subtitle mt-1">Feedback you&apos;ve submitted and its review status.</p>

      {submissions.length === 0 ? (
        <EmptyState className="mt-6" title="No submissions yet" description="Feedback you submit will show up here." />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-metadata">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Template</th>
                <th className="px-4 py-2.5 font-medium">Submitted</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{s.employeeName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatReviewPeriod(s.reviewPeriod)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Template {s.templateType}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.submittedAt.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
