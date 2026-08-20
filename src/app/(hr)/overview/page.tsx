import { Users, Mail } from "lucide-react";
import { getOverview, getDepartmentProgress } from "@/services/review/dashboard";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";
import { formatReviewPeriod } from "@/domain/review/period";
import { PageHeader } from "@/components/shared/page-header";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { ReviewPipeline } from "@/components/hr/review-pipeline";
import { NextAction } from "@/components/hr/next-action";
import { DepartmentProgressList } from "@/components/hr/department-progress";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  const organizations = await getScopeOrganizations();
  const { organizationId } = resolveScope(organizations, params);

  const [counters, departments] = await Promise.all([
    getOverview(undefined, organizationId),
    getDepartmentProgress(undefined, organizationId),
  ]);

  const scopeLabel = organizations.find((o) => o.id === organizationId)?.name ?? "All organizations";
  const orgQuery = organizationId ? `?org=${organizationId}` : "";
  const completion =
    counters.totalEmployees === 0 ? 0 : Math.round((counters.submitted / counters.totalEmployees) * 100);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow={`${formatReviewPeriod(counters.period)} · ${scopeLabel}`}
        title="Performance Review"
        description="Collect feedback from Department Heads, confirm it, then send every confirmed email in one action."
        actions={<ScopeFilter organizations={organizations} showDepartment={false} />}
      />

      {counters.totalEmployees === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Import them from HR's spreadsheet, or add them under Administration."
        />
      ) : (
        <>
          <NextAction counters={counters} orgQuery={orgQuery} />

          <section>
            <h2 className="text-eyebrow mb-2.5">Pipeline</h2>
            <ReviewPipeline counters={counters} orgQuery={orgQuery} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Department progress</CardTitle>
                <p className="text-page-subtitle">Ordered by how many people are still outstanding.</p>
              </CardHeader>
              <CardContent>
                <DepartmentProgressList departments={departments} />
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle>This cycle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">Feedback collected</span>
                    <span className="text-metric">{completion}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                      style={{ width: `${completion > 0 ? Math.max(completion, 3) : 0}%` }}
                    />
                  </div>
                  <p className="text-metadata mt-1.5">
                    {counters.submitted} of {counters.totalEmployees} employees
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-4">
                  <Stat icon={Users} label="Employees" value={counters.totalEmployees} />
                  <Stat icon={Mail} label="Emails sent" value={counters.sent} />
                </dl>

                {counters.needsRevision > 0 && (
                  <p className="rounded-lg border border-destructive/20 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
                    {counters.needsRevision} sent back for revision — waiting on the Department Head.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-metadata">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="text-metric mt-0.5">{value}</dd>
    </div>
  );
}
