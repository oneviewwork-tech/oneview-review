import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/shared/avatar";
import { SearchField } from "@/components/shared/search-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { ConfirmButton } from "@/components/hr/confirm-button";
import { RequestRevisionButton } from "@/components/hr/request-revision-button";
import { SendAllButton } from "@/components/hr/send-all-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";
import { formatReviewPeriod } from "@/domain/review/period";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; department?: string; q?: string }>;
}) {
  const params = await searchParams;
  const organizations = await getScopeOrganizations();
  const scope = resolveScope(organizations, params);
  const q = params.q?.trim() ?? "";

  const search: Prisma.FeedbackSubmissionWhereInput = q
    ? {
        OR: [
          { employeeName: { contains: q, mode: "insensitive" } },
          { employeeEmail: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const submissions = await prisma.feedbackSubmission.findMany({
    where: {
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
      ...search,
    },
    orderBy: { submittedAt: "desc" },
  });

  const confirmedCount = submissions.filter((s) => s.status === "CONFIRMED").length;
  const showOrgColumn = !scope.organizationId;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Submissions"
        description="Read each submission, preview the exact email, then confirm it or send it back for revision."
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchField className="w-full sm:w-72" placeholder="Search employee…" />
        <ScopeFilter organizations={organizations} />
      </div>

      <div className="mt-4">
        <SendAllButton
          count={confirmedCount}
          organizationId={scope.organizationId}
          departmentId={scope.departmentId}
        />
      </div>

      {submissions.length === 0 ? (
        <EmptyState className="mt-6" title="No submissions" description="Nothing has been submitted for this filter yet." />
      ) : (
        <Card className="mt-5 overflow-hidden p-0">
          <div className="max-h-[calc(100vh-21rem)] overflow-auto">
          <table className="data-table table-sticky-head min-w-[880px]">
            <thead>
              <tr>
                <th>Employee</th>
                {showOrgColumn && <th>Organization</th>}
                <th>Department</th>
                <th>Period</th>
                <th>Template</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/submissions/${s.id}`} className="flex items-center gap-2.5 group">
                      <Avatar name={s.employeeName} />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate font-medium text-foreground group-hover:text-brand">{s.employeeName}</p>
                        <p className="truncate text-metadata">{s.employeeEmail}</p>
                      </div>
                    </Link>
                  </td>
                  {showOrgColumn && <td className="text-muted-foreground">{s.organizationName}</td>}
                  <td className="text-muted-foreground">{s.departmentName}</td>
                  <td className="text-muted-foreground">{formatReviewPeriod(s.reviewPeriod)}</td>
                  <td className="text-muted-foreground">Template {s.templateType}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>
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
          </div>
        </Card>
      )}
    </div>
  );
}
