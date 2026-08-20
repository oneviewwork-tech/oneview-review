import Link from "next/link";
import { Users, Send, Clock, CheckCircle2, Mail } from "lucide-react";
import { getOverview, getDepartmentProgress } from "@/services/review/dashboard";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";
import { formatReviewPeriod } from "@/domain/review/period";
import { StatTile } from "@/components/shared/stat-tile";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

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

  const scopeLabel = organizations.find((o) => o.id === organizationId)?.name ?? "All Organizations";

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page-title">Performance Review</h1>
          <p className="text-page-subtitle mt-1">
            {formatReviewPeriod(counters.period)} · {scopeLabel}
          </p>
        </div>
        <ScopeFilter organizations={organizations} showDepartment={false} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total Employees" value={counters.totalEmployees} icon={Users} />
        <StatTile label="Submitted" value={counters.submitted} icon={Send} emphasis />
        <StatTile label="Pending" value={counters.pending} icon={Clock} />
        <StatTile label="Confirmed" value={counters.confirmed} icon={CheckCircle2} />
        <StatTile label="Emails Sent" value={counters.sent} icon={Mail} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Department Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {departments.length === 0 && (
            <p className="text-sm text-muted-foreground">No departments in this organization yet.</p>
          )}
          {departments.map((d) => {
            const pct = d.totalEmployees === 0 ? 0 : Math.round((d.submitted / d.totalEmployees) * 100);
            const complete = d.totalEmployees > 0 && d.submitted >= d.totalEmployees;
            return (
              <div key={d.departmentId}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    {d.departmentName}
                    {complete && <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label="complete" />}
                  </span>
                  <span className={cn("tabular-nums", complete ? "text-success" : "text-muted-foreground")}>
                    {d.submitted} / {d.totalEmployees}
                  </span>
                </div>
                {/* 4px rounded data-end anchored to the baseline; the track
                    stays recessive so the filled portion carries the reading. */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      complete ? "bg-success" : "bg-brand"
                    )}
                    style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {counters.totalEmployees === 0 ? (
        <EmptyState
          className="mt-6"
          title="No employees yet"
          description="Add employees under Administration, or import them from HR's spreadsheet."
        />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Review individual submissions on the{" "}
          <Link href="/submissions" className="font-medium text-brand hover:underline">
            Submissions
          </Link>{" "}
          page.
        </p>
      )}
    </div>
  );
}
