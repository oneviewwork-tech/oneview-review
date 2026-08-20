import Link from "next/link";
import { Undo2 } from "lucide-react";
import { requireReviewAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatReviewPeriod } from "@/domain/review/period";

export default async function MySubmissionsPage() {
  const { user } = await requireReviewAccess();

  const submissions = await prisma.feedbackSubmission.findMany({
    where: { departmentHeadId: user.id },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="My Submissions"
        description="Feedback you have submitted, and where each one has got to."
      />

      {submissions.length === 0 ? (
        <EmptyState className="mt-6" title="No submissions yet" description="Feedback you submit will show up here." />
      ) : (
        <div className="mt-6 space-y-3">
          {submissions.some((s) => s.status === "NEEDS_REVISION") && (
            <Card className="border-orange-500/25 bg-orange-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
                <Undo2 className="h-4 w-4" />
                HR sent feedback back for revision. See below.
              </p>
            </Card>
          )}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-metadata">
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 font-medium">Template</th>
                  <th className="px-4 py-2.5 font-medium">Submitted</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-border-subtle transition-ui last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {s.employeeName}
                      {s.status === "NEEDS_REVISION" && s.revisionNote && (
                        <p className="mt-0.5 max-w-xs truncate text-xs font-normal text-orange-600 dark:text-orange-400" title={s.revisionNote}>
                          {s.revisionNote}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatReviewPeriod(s.reviewPeriod)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">Template {s.templateType}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.submittedAt.toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.status === "NEEDS_REVISION" && (
                        <Link href={`/my-submissions/${s.id}/revise`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          Revise
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
