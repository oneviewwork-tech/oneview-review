import Link from "next/link";
import { Users, Send, Clock, CheckCircle2, Mail } from "lucide-react";
import { getOverview, getDepartmentProgress } from "@/services/review/dashboard";
import { formatReviewPeriod } from "@/domain/review/period";
import { StatTile } from "@/components/shared/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  const [counters, departments] = await Promise.all([getOverview(), getDepartmentProgress()]);

  return (
    <div className="animate-fade-up">
      <h1 className="text-page-title">Performance Review</h1>
      <p className="text-page-subtitle mt-1">{formatReviewPeriod(counters.period)}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
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
          {departments.map((d) => {
            const pct = d.totalEmployees === 0 ? 0 : Math.round((d.submitted / d.totalEmployees) * 100);
            return (
              <div key={d.departmentId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{d.departmentName}</span>
                  <span className="text-muted-foreground">
                    {d.submitted} / {d.totalEmployees}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="mt-6 text-sm text-muted-foreground">
        Review individual submissions on the{" "}
        <Link href="/submissions" className="font-medium text-brand hover:underline">
          Submissions
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
