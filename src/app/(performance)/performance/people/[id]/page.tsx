import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Clock, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/shared/avatar";
import { PeriodFilter } from "@/components/hr/period-filter";
import { ScoreMeter, formatPoints } from "@/components/performance/score-meter";
import { FeedbackCard } from "@/components/performance/feedback-card";
import { ReviewStatusBadge } from "@/components/performance/review-status-badge";
import { ReviewDecision, SubmitMonthButton } from "@/components/performance/workflow-actions";
import { canDecide, canEditScores, canSubmit, mayDecide, mayViewScores } from "@/domain/performance/workflow";
import { prisma } from "@/lib/prisma";
import { getPerformanceAccess, canScore, canView } from "@/services/performance/access";
import { getPersonFeedback } from "@/services/performance/feedback";
import { getPersonPerformance, kpiDefsOf, MAX_WEEKS } from "@/services/performance/data";
import { kpiPoints, partsOf } from "@/domain/performance/engine";
import { formatPeriodValue, formatReviewPeriod, parseReviewPeriod, selectablePeriods } from "@/domain/review/period";
import { cn } from "@/lib/utils";
import { bandOf } from "@/domain/performance/grading";
import { MyScorecard } from "@/components/performance/my-scorecard";
import { RateManagers, type RateTarget } from "@/components/performance/rate-managers";
import { photoUrlFor } from "@/services/people/photo";
import { getGradeSettings } from "@/services/performance/settings";

export default async function PersonPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const periods = selectablePeriods(12);
  const period = (query.period && parseReviewPeriod(query.period)) || periods[0];
  const periodValue = formatPeriodValue(period);
  const periodOptions = periods.map((p) => ({ value: formatPeriodValue(p), label: formatReviewPeriod(p) }));

  const access = await getPerformanceAccess();
  // A person outside the viewer's reach looks exactly like one that
  // doesn't exist — the page must not confirm who has a scorecard.
  if (!canView(access, id)) notFound();

  const [data, feedback] = await Promise.all([getPersonPerformance(id, period), getPersonFeedback(access, id)]);
  if (!data) {
    // No scorecard yet, but the person (and any feedback about them) is
    // still worth showing — Feedback and Performance are one product.
    const person = await prisma.employee.findUnique({
      where: { id },
      select: { name: true, designation: true, department: { select: { name: true } } },
    });
    if (!person) notFound();
    return (
      <div className="animate-fade-up">
        <PageHeader title={person.name} description={`${person.designation ?? "-"} · ${person.department.name}`} />
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <EmptyState title="No scorecard assigned" description="HR can assign a scorecard and a scorer under Assignments." />
          <FeedbackCard items={feedback} />
        </div>
      </div>
    );
  }

  const { employee, template, version, entries, weekTotals, month, maxTotal, review, penalties } = data;
  // Who it goes to: the named reviewer once submitted, else whoever scores the scorer.
  const reviewerName = review ? review.reviewerName : data.expectedReviewerName;
  const formatWhen = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const kpiById = new Map(version ? kpiDefsOf(version).map((k) => [k.id, k]) : []);
  const partOf = partsOf(version ? kpiDefsOf(version) : []);
  // Anyone looking at their own scorecard (a scorer is someone's employee
  // too): they see what they are measured on and their role definition, and
  // — once the month is confirmed — only the band their score falls in
  // ("85–100 · High Performer"), never the number or the week-by-week marks.
  // Approval details and feedback aren't part of it.
  const employeeView = id === access.selfEmployeeId;
  const showScores = mayViewScores(employeeView, data.reviewState);
  const exactScores = showScores && !employeeView;
  const finalScore = review?.status === "CONFIRMED" && review.finalScore != null ? review.finalScore : month.average;
  const band = employeeView && showScores && finalScore != null && maxTotal > 0 ? bandOf((finalScore / maxTotal) * 100, await getGradeSettings()) : null;


  // Everyone gets the same board. The person themselves sees only their
  // band; anyone else (scorer, reviewer, HR, Admin) sees the real numbers.
  const [settings, past, photoUrl] = await Promise.all([
    getGradeSettings(),
    prisma.perfReview.findMany({
      where: { employeeId: id, status: "CONFIRMED", period: { lt: period }, finalScore: { not: null }, maxScore: { gt: 0 } },
      orderBy: { period: "desc" },
      take: 6,
      select: { period: true, finalScore: true, maxScore: true },
    }),
    photoUrlFor(id),
  ]);
  const kras = (version?.kras ?? []).map((kra) => ({
    id: kra.id,
    name: kra.name,
    max: kra.kpis.reduce((n, k) => n + k.maxPoints, 0),
    part: (kra.kpis[0] && partOf.get(kra.kpis[0].id)) || ("PERFORMANCE" as const),
    kpis: kra.kpis.map((k) => ({ id: k.id, name: k.name, max: k.maxPoints, description: k.description })),
  }));
  const critical = (version?.risks ?? []).filter((r) => r.deductible);
  const risks = [...new Set(critical.map((r) => r.category))].map((g) => ({
    group: g,
    items: critical.filter((r) => r.category === g).map((r) => r.name),
  }));
  const board = {
    name: employee.name,
    designation: employee.designation,
    department: employee.departmentName,
    scorerName: data.scorer.name,
    reviewerName: reviewerName,
    monthLabel: formatReviewPeriod(period),
    periodOptions: periodOptions,
    state: data.reviewState,
    band: band,
    bands: [bandOf(100, settings), bandOf(settings.gradeB, settings), bandOf(0, settings)],
    confirmedOn: review?.status === "CONFIRMED" && review.decidedAt ? formatWhen(review.decidedAt) : null,
    kras: kras,
    performanceMax: month.performanceMax,
    potentialMax: month.potentialMax,
    risks: risks,
    roleDefinition: template.roleDefinition,
    responsibilities: (template.responsibilities ?? "").split("\n").map((l) => l.trim()).filter(Boolean),
    templateName: template.name,
    photoUrl: photoUrl,
    history: past.map((p) => ({
      label: p.period.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      band: bandOf((p.finalScore! / p.maxScore!) * 100, settings),
    })),
  };
  if (employeeView) {
    // Confirmed month: they may rate their manager (scorer) and head (reviewer), privately.
    let rate: React.ReactNode = null;
    if (review?.status === "CONFIRMED") {
      const [row, given] = await Promise.all([
        prisma.perfReview.findUnique({
          where: { employeeId_period: { employeeId: id, period } },
          select: { submittedById: true, submittedBy: { select: { name: true } }, reviewerUserId: true, reviewer: { select: { name: true } } },
        }),
        prisma.managerRating.findMany({ where: { raterEmployeeId: id, period }, select: { ratedAs: true, stars: true } }),
      ]);
      const starsFor = (k: "SCORER" | "REVIEWER") => given.find((g) => g.ratedAs === k)?.stars ?? null;
      const targets: RateTarget[] = [];
      if (row && row.submittedById !== access.user.id) {
        targets.push({ ratedAs: "SCORER", role: "Your manager", name: row.submittedBy.name, given: starsFor("SCORER") });
      }
      if (row?.reviewerUserId && row.reviewer && row.reviewerUserId !== row.submittedById && row.reviewerUserId !== access.user.id) {
        targets.push({ ratedAs: "REVIEWER", role: "Your head", name: row.reviewer.name, given: starsFor("REVIEWER") });
      }
      if (targets.length) rate = <RateManagers period={periodValue} monthLabel={formatReviewPeriod(period)} targets={targets} />;
    }
    return <MyScorecard {...board}>{rate}</MyScorecard>;
  }

  const weeks = exactScores ? Array.from({ length: MAX_WEEKS }, (_, i) => i + 1).filter((w) => w <= 4 || entries.has(w)) : [];

  const remarks: { week: number; kpi: string; text: string }[] = [];
  for (const kra of version?.kras ?? []) {
    for (const kpi of kra.kpis) {
      for (const w of weeks) {
        const text = entries.get(w)?.get(kpi.id)?.remark;
        if (text) remarks.push({ week: w, kpi: kpi.name, text });
      }
    }
  }

  const pointsFor = (kpiId: string, week: number): number | null => {
    const entry = entries.get(week)?.get(kpiId);
    const def = kpiById.get(kpiId);
    return entry && def ? kpiPoints(def, entry.value) : null;
  };

  // Month average per KPI and KRA, over the weeks that were scored (a KPI
  // left blank in a scored week counts as 0 there, as in the week total).
  const scoredWeeks = [...weekTotals.keys()];
  const avgOf = (kpiId: string) =>
    scoredWeeks.length === 0 ? null : scoredWeeks.reduce((n, w) => n + (pointsFor(kpiId, w) ?? 0), 0) / scoredWeeks.length;
  const managerKras = board.kras.map((kra) => {
    const kpis = kra.kpis.map((k) => ({ ...k, points: avgOf(k.id) }));
    return { ...kra, kpis, points: scoredWeeks.length ? kpis.reduce((n, k) => n + (k.points ?? 0), 0) : null };
  });
  const riskName = new Map((version?.risks ?? []).map((r) => [r.id, r.name]));
  const exact = {
    score: month.weeksScored > 0 ? finalScore : null,
    max: maxTotal,
    performance: month.performance,
    potential: month.potential,
    deduction: month.deduction,
    penalties: Object.fromEntries([...penalties].map(([riskId, p]) => [riskName.get(riskId) ?? riskId, p.points])),
    weeksScored: month.weeksScored,
  };
  const managerBand = exact.score != null && maxTotal > 0 ? bandOf((exact.score / maxTotal) * 100, settings) : null;

  return (
    <MyScorecard {...board} kras={managerKras} band={managerBand} exact={exact} actions={<>
            {(!employeeView || data.reviewState === "CONFIRMED") && <ReviewStatusBadge state={data.reviewState} />}
            {canScore(access, id) && canEditScores(data.reviewState) && (
              <Link href={`/performance/score?employee=${id}&period=${periodValue}`} className={buttonVariants({ size: "sm" })}>
                <Target className="size-4" /> Score
              </Link>
            )}
            {canScore(access, id) && canSubmit(data.reviewState, month.weeksScored) && (
              <SubmitMonthButton
                employeeId={id}
                period={periodValue}
                personName={employee.name}
                monthLabel={formatReviewPeriod(period)}
                reviewerName={reviewerName}
              />
            )}
          </>}>
      <h2 className="mt-10 text-lg font-semibold">Week by week</h2>
      <div className="mt-3 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {employeeView && !showScores && version && (
            <Card className="flex items-start gap-3 bg-brand-subtle p-4 text-sm">
              <Clock className="mt-0.5 size-5 shrink-0 text-brand" />
              <div>
                <p className="font-semibold">Your {formatReviewPeriod(period)} result isn&apos;t final yet</p>
                <p className="mt-1 text-muted-foreground">
                  It appears here once the month has been reviewed and confirmed. Below is what you&apos;re measured on. Use the month
                  picker to see a month that&apos;s already confirmed.
                </p>
              </div>
            </Card>
          )}

          {!version ? (
            <EmptyState title="No scorecard in force for this month" description="This template's first version starts in a later month." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="text-metadata px-4 py-3 font-semibold">KRA / KPI</th>
                    <th className="text-metadata px-3 py-3 text-right font-semibold">Max</th>
                    {weeks.map((w) => (
                      <th key={w} className="text-metadata px-3 py-3 text-right font-semibold">
                        Wk {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {version.kras.map((kra, i) => {
                    const kraMax = kra.kpis.reduce((s, k) => s + k.maxPoints, 0);
                    // A heading where the scorecard moves into its next part (Performance 60 / Potential 40).
                    const part = kra.kpis[0] ? partOf.get(kra.kpis[0].id) : undefined;
                    const prev = i > 0 ? version.kras[i - 1].kpis[0] : undefined;
                    const startsPart = part && (i === 0 || (prev && partOf.get(prev.id) !== part));
                    return (
                      <Fragment key={kra.id}>
                      {startsPart && (
                        <tr className="bg-brand-subtle/60">
                          <td colSpan={2 + weeks.length} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand">
                            {part === "PERFORMANCE" ? `Performance · ${formatPoints(month.performanceMax)} pts` : `Potential · ${formatPoints(month.potentialMax)} pts`}
                          </td>
                        </tr>
                      )}
                      <KraBlock name={kra.name} max={kraMax}>
                        {kra.kpis.map((kpi) => (
                          <tr key={kpi.id} className="border-b border-border/60">
                            <td className="px-4 py-2 pl-8">
                              <span>{kpi.name}</span>
                              {kpi.mode === "TARGET" && kpi.target != null && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  target {kpi.direction === "LOWER_IS_BETTER" ? "≤" : "≥"} {kpi.target}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatPoints(kpi.maxPoints)}</td>
                            {weeks.map((w) => {
                              const pts = pointsFor(kpi.id, w);
                              const raw = entries.get(w)?.get(kpi.id);
                              return (
                                <td
                                  key={w}
                                  className={cn("px-3 py-2 text-right tabular-nums", pts == null && "text-muted-foreground")}
                                  title={kpi.mode === "TARGET" && raw ? `Measured ${raw.value}` : undefined}
                                >
                                  {pts == null ? "·" : formatPoints(pts)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </KraBlock>
                      </Fragment>
                    );
                  })}
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-4 py-3">{exactScores ? "Week total" : "Total"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatPoints(maxTotal)}</td>
                    {weeks.map((w) => (
                      <td key={w} className="px-3 py-3 text-right tabular-nums">
                        {weekTotals.get(w) ? formatPoints(weekTotals.get(w)!.total) : "·"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </Card>
          )}

          {remarks.length > 0 && (
            <Card className="p-4">
              <p className="text-metadata mb-3">Remarks</p>
              <ul className="space-y-2.5 text-sm">
                {remarks.map((r, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-10 shrink-0 text-xs font-semibold text-muted-foreground">Wk {r.week}</span>
                    <span>
                      <span className="font-medium">{r.kpi}.</span> {r.text}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

        </div>

        <div className="space-y-5">

          {!employeeView && (
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-metadata">Approval</p>
              <ReviewStatusBadge state={data.reviewState} />
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {review ? (
                <>
                  <li>
                    <span className="text-muted-foreground">Submitted by </span>
                    <span className="font-medium">{review.submittedByName}</span>
                    <span className="text-muted-foreground"> · {formatWhen(review.submittedAt)}</span>
                  </li>
                  <li>
                    <span className="text-muted-foreground">Reviewer </span>
                    <span className="font-medium">{review.reviewerName ?? "None, went straight to HR"}</span>
                  </li>
                  {review.decidedAt && (
                    <li>
                      <span className="text-muted-foreground">{review.status === "CONFIRMED" ? "Confirmed by " : "Sent back by "}</span>
                      <span className="font-medium">{review.decidedByName}</span>
                      <span className="text-muted-foreground"> · {formatWhen(review.decidedAt)}</span>
                    </li>
                  )}
                  {review.status === "CONFIRMED" && review.finalScore != null && review.maxScore != null && (
                    <li>
                      <span className="text-muted-foreground">Final score </span>
                      <span className="font-semibold">
                        {formatPoints(review.finalScore)} / {formatPoints(review.maxScore)}
                      </span>
                      <span className="text-muted-foreground"> · with HR</span>
                    </li>
                  )}
                </>
              ) : (
                <li className="text-muted-foreground">
                  Still being scored by {data.scorer.name}. It goes to {reviewerName ?? "HR"} once submitted.
                </li>
              )}
            </ul>
            {review?.status === "NEEDS_REVISION" && review.revisionNote && (
              <p className="mt-3 rounded-xl bg-destructive-subtle px-3 py-2.5 text-sm text-destructive">
                <span className="font-semibold">Changes requested: </span>
                {review.revisionNote}
              </p>
            )}
            {review && canDecide(data.reviewState) && mayDecide({ id: access.user.id, canDecideAny: access.canDecideAny }, review.reviewerUserId) && (
              <div className="mt-4 border-t border-border pt-4">
                <ReviewDecision reviewId={review.id} personName={employee.name} />
              </div>
            )}
          </Card>
          )}

          {!employeeView && <FeedbackCard items={feedback} />}

        </div>
      </div>
    </MyScorecard>
  );
}

function KraBlock({ name, max, children }: { name: string; max: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-b border-border bg-muted/30">
        <td className="px-4 py-2 font-semibold">{name}</td>
        <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-muted-foreground">{formatPoints(max)}</td>
        <td colSpan={5} />
      </tr>
      {children}
    </>
  );
}
