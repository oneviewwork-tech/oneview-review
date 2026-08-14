import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DepartmentFilter } from "@/components/hr/department-filter";
import { ConfirmButton } from "@/components/hr/confirm-button";
import { RequestRevisionButton } from "@/components/hr/request-revision-button";
import { SendAllButton } from "@/components/hr/send-all-button";
import { Card } from "@/components/ui/card";
import { formatReviewPeriod } from "@/domain/review/period";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const { department } = await searchParams;

  const [departments, submissions] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.feedbackSubmission.findMany({
      where: department ? { departmentId: department } : undefined,
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  const confirmedCount = submissions.filter((s) => s.status === "CONFIRMED").length;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">Submissions</h1>
          <p className="text-page-subtitle mt-1">Review, confirm, and send performance feedback emails.</p>
        </div>
        <DepartmentFilter departments={departments} />
      </div>

      <div className="mt-4">
        <SendAllButton count={confirmedCount} departmentId={department} />
      </div>

      {submissions.length === 0 ? (
        <EmptyState className="mt-6" title="No submissions" description="Nothing has been submitted for this filter yet." />
      ) : (
        <Card className="mt-6 overflow-x-auto p-0">
          <table className="w-full text-table">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-metadata">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Template</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-border-subtle transition-ui last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    <Link href={`/submissions/${s.id}`} className="hover:text-brand hover:underline">
                      {s.employeeName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.departmentName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatReviewPeriod(s.reviewPeriod)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">Template {s.templateType}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      {s.status === "SUBMITTED" && (
                        <>
                          <RequestRevisionButton submissionId={s.id} />
                          <ConfirmButton submissionId={s.id} />
                        </>
                      )}
                      {s.status !== "SUBMITTED" && (
                        <Link href={`/submissions/${s.id}`} className="text-sm font-medium text-brand hover:underline">
                          View
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
