import Link from "next/link";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilter } from "@/components/hr/period-filter";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { ReviewStatusBadge } from "@/components/performance/review-status-badge";
import { ScoreMeter } from "@/components/performance/score-meter";
import { Panel } from "@/components/performance/dashboard-widgets";
import { SendRemindersButton, ReviewDecision } from "@/components/performance/workflow-actions";
import { buttonVariants } from "@/components/ui/button-variants";
import { getPerformanceAccess } from "@/services/performance/access";
import { getTeamRows, type TeamRow } from "@/services/performance/data";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";
import { mayDecide, periodInPlay } from "@/domain/performance/workflow";
import { formatPeriodValue, formatReviewPeriod, parseReviewPeriod, selectablePeriods } from "@/domain/review/period";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; org?: string; department?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const periods = selectablePeriods(12);
  // Defaults to the month in play: early in a month that is still last month's.
  const period = (params.period && parseReviewPeriod(params.period)) || periodInPlay(new Date());
  const periodValue = formatPeriodValue(period);
  const periodOptions = periods.map((p) => ({ value: formatPeriodValue(p), label: formatReviewPeriod(p) }));

  const [access, organizations] = await Promise.all([getPerformanceAccess(), getScopeOrganizations()]);
  // Nothing to review or submit: an employee's only page here is their own scorecard.
  if (access.selfOnly) redirect("/performance");
  const scope = access.isStaff ? resolveScope(organizations, params) : {};
  const allRows = await getTeamRows(null, period, scope);

  // HR and Admin see every submission; everyone else sees the ones they sent
  // or are meant to review — nobody else's.
  const rows = access.isStaff
    ? allRows
    : allRows.filter((r) => r.scorerUserId === access.user.id || r.reviewerUserId === access.user.id);

  const mine = rows.filter((r) => r.reviewState === "SUBMITTED" && mayDecide({ id: access.user.id, canDecideAny: access.canDecideAny }, r.reviewerUserId));
  const withReviewers = rows.filter((r) => r.reviewState === "SUBMITTED" && !mine.includes(r));
  const sentBack = rows.filter((r) => r.reviewState === "NEEDS_REVISION");
  const confirmed = rows.filter((r) => r.reviewState === "CONFIRMED");

  const tabs = [
    { key: "waiting", title: "Waiting for you", hint: "Confirm to send it on to HR, or send it back with a note.", rows: mine, empty: "Nothing is waiting on you." },
    { key: "with", title: access.isStaff ? "With reviewers" : "With the reviewer", hint: "Submitted and waiting for the department head to decide.", rows: withReviewers, empty: "None." },
    { key: "sent", title: "Sent back", hint: "The scorer has the reviewer's note and needs to resubmit.", rows: sentBack, empty: "None." },
    { key: "confirmed", title: "Confirmed", hint: "Approved and final, with HR.", rows: confirmed, empty: "Nothing confirmed yet." },
  ];
  // Open on what needs the viewer: their queue if it has anything, else the first tab with rows.
  const activeTab =
    tabs.find((t) => t.key === params.tab) ?? (mine.length > 0 ? tabs[0] : (tabs.find((t) => t.rows.length > 0) ?? tabs[0]));

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={formatReviewPeriod(period)}
        title="Reviews"
        description={
          access.isStaff
            ? "Every month a Team Lead has submitted: what's with a reviewer, what was sent back, and what has reached HR."
            : "Submissions waiting for your review, and the ones you've sent."
        }
        actions={
          <>
            {access.isStaff && <ScopeFilter organizations={organizations} />}
            <PeriodFilter periods={periodOptions} />
            {access.isStaff && <SendRemindersButton period={periodValue} />}
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Nothing to review yet"
          description="When a Team Lead submits a month, it appears here for their reviewer."
        />
      ) : (
        <div className="mt-6">
          <nav className="no-scrollbar flex gap-2 overflow-x-auto" aria-label="Review status">
            {tabs.map((t) => {
              const on = t.key === activeTab.key;
              const q = new URLSearchParams({ ...(params.period ? { period: params.period } : {}), ...(params.org ? { org: params.org } : {}), ...(params.department ? { department: params.department } : {}), tab: t.key });
              return (
                <Link
                  key={t.key}
                  href={`/performance/reviews?${q.toString()}`}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-ui",
                    on ? "bg-ink text-ink-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.title}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      on ? "bg-white/15" : t.key === "waiting" && t.rows.length > 0 ? "bg-brand text-brand-foreground" : "bg-muted"
                    )}
                  >
                    {t.rows.length}
                  </span>
                </Link>
              );
            })}
          </nav>
          <p className="mt-3 text-sm text-muted-foreground">{activeTab.hint}</p>
          <Section
            rows={activeTab.rows}
            periodValue={periodValue}
            empty={activeTab.empty}
            decide={activeTab.key === "waiting"}
            showNote={activeTab.key === "sent"}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  rows,
  periodValue,
  empty,
  decide,
  showNote,
}: {
  rows: TeamRow[];
  periodValue: string;
  empty: string;
  /** Confirm / Send back right in the row. */
  decide?: boolean;
  /** Show the reviewer's note (sent-back rows). */
  showNote?: boolean;
}) {
  return (
    <section className="mt-3">
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th className="pl-6">Person</th>
                <th>Scored by</th>
                <th>Reviewer</th>
                <th>Month score</th>
                <th>Performance</th>
                <th>Potential</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td className="pl-6">
                    <Link href={`/performance/people/${r.employeeId}?period=${periodValue}`} className="flex items-center gap-2.5 hover:text-brand">
                      <Avatar name={r.name} />
                      <span className="leading-tight">
                        <span className="block font-medium">{r.name}</span>
                        <span className="block text-xs text-muted-foreground">{r.departmentName}</span>
                        {showNote && r.revisionNote && (
                          <span className="mt-1 block max-w-xs text-xs text-destructive">“{r.revisionNote}”</span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="text-muted-foreground">{r.scorerName}</td>
                  <td className="text-muted-foreground">{r.reviewerName ?? "Straight to HR"}</td>
                  <td>
                    <ScoreMeter score={r.average} max={r.maxTotal} />
                  </td>
                  <td className="tabular-nums">{r.performance != null ? `${r.performance} / ${r.performanceMax}` : "-"}</td>
                  <td className="tabular-nums">{r.potential != null ? `${r.potential} / ${r.potentialMax}` : "-"}</td>
                  <td>
                    <ReviewStatusBadge state={r.reviewState} />
                  </td>
                  <td className="pr-6">
                    <div className="flex items-center justify-end gap-2">
                      {decide && r.reviewId ? (
                        <ReviewDecision reviewId={r.reviewId} personName={r.name} size="sm" />
                      ) : null}
                      <Link
                        href={`/performance/people/${r.employeeId}?period=${periodValue}`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}
                      >
                        {decide ? "Details" : "Open"}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </section>
  );
}
