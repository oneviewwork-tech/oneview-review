import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreForm, type ScoreFormKra } from "@/components/performance/score-form";
import { getPerformanceAccess } from "@/services/performance/access";
import { getPersonPerformance, getTeamRows } from "@/services/performance/data";
import { weekLockReason, weekRange, weeksOf } from "@/domain/performance/weeks";
import { formatPeriodValue, formatReviewPeriod, parseReviewPeriod, selectablePeriods } from "@/domain/review/period";

export default async function ScoreTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; period?: string; week?: string }>;
}) {
  const query = await searchParams;
  const access = await getPerformanceAccess();
  // Nobody to score: an employee's only page here is their own scorecard.
  if (access.selfOnly) redirect("/performance");

  // Everyone this person may enter scores for. An Admin may act for anyone
  // with a scorecard; everyone else only for the people assigned to them.
  const assignments = await prisma.perfAssignment.findMany({
    where: access.isAdmin ? {} : { scorerUserId: access.user.id },
    include: { employee: { select: { id: true, name: true, designation: true } }, template: { select: { name: true } } },
    orderBy: { employee: { name: "asc" } },
  });

  if (assignments.length === 0) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Score Team" description="Enter weekly scores for the people you score." />
        <EmptyState className="mt-5" title="You don't score anyone yet" description="When HR assigns people to you, they will appear here." />
      </div>
    );
  }

  const periods = selectablePeriods(12);
  const period = (query.period && parseReviewPeriod(query.period)) || periods[0];
  const periodValue = formatPeriodValue(period);
  const selected = assignments.find((a) => a.employeeId === query.employee) ?? assignments[0];

  // Each person's progress this month, for the team strip (small teams only).
  const [data, teamRows] = await Promise.all([
    getPersonPerformance(selected.employeeId, period),
    assignments.length <= 15 ? getTeamRows(assignments.map((a) => a.employeeId), period) : Promise.resolve([]),
  ]);
  const progress = new Map(teamRows.map((r) => [r.employeeId, r]));
  const requestedWeek = Number(query.week);
  // Weeks are Monday to Saturday and open in order; land on the one that
  // needs scoring next, or the latest scored one if none is open.
  const scoredWeeks = [...(data?.entries.keys() ?? [])];
  const calendar = weeksOf(period);
  const lockOf = (w: number) => weekLockReason(period, w, scoredWeeks);
  const nextOpen = calendar.find((w) => !scoredWeeks.includes(w.week) && !lockOf(w.week))?.week;
  const fallback = nextOpen ?? (scoredWeeks.length ? Math.max(...scoredWeeks) : 1);
  const week = calendar.some((w) => w.week === requestedWeek) ? requestedWeek : fallback;
  const weekOptions = calendar.map((w) => ({
    value: String(w.week),
    label: `Week ${w.week} · ${weekRange(w)}`,
    hint: scoredWeeks.includes(w.week) ? "scored" : lockOf(w.week) ? "locked" : "open",
  }));

  const kras: ScoreFormKra[] =
    data?.version?.kras.map((kra) => ({
      id: kra.id,
      name: kra.name,
      kpis: kra.kpis.map((k) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        maxPoints: k.maxPoints,
        mode: k.mode,
        target: k.target,
        direction: k.direction,
        value: data.entries.get(week)?.get(k.id)?.value ?? null,
        remark: data.entries.get(week)?.get(k.id)?.remark ?? null,
      })),
    })) ?? [];

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={formatReviewPeriod(period)}
        title="Score Team"
        description="Pick a person and a week, then award points against each KPI. Leave a field blank to leave it unscored."
      />
      <ScoreForm
        people={assignments.map((a) => {
          const row = progress.get(a.employeeId);
          return {
            id: a.employeeId,
            name: a.employee.name,
            hint: `${a.employee.designation ?? a.template.name}`,
            weeksScored: row?.weeksScored ?? 0,
            state: row?.reviewState ?? "DRAFT",
          };
        })}
        monthWeeks={calendar.length}
        employeeId={selected.employeeId}
        employeeName={selected.employee.name}
        templateName={selected.template.name}
        period={periodValue}
        periodOptions={periods.map((p) => ({ value: formatPeriodValue(p), label: formatReviewPeriod(p) }))}
        week={week}
        weekOptions={weekOptions}
        criticalKpis={(data?.version?.risks ?? [])
          .filter((r) => r.deductible)
          .map((r) => ({
            id: r.id,
            category: r.category,
            name: r.name,
            description: r.description,
            maxPenalty: r.maxPenalty,
            points: data?.penalties.get(r.id)?.points ?? null,
            remark: data?.penalties.get(r.id)?.remark ?? null,
          }))}
        monthBase={data?.month.base ?? null}
        maxTotal={data?.maxTotal ?? 0}
        weekLock={lockOf(week)}
        kras={kras}
        hasVersion={!!data?.version}
        reviewState={data?.reviewState ?? "DRAFT"}
        revisionNote={data?.review?.revisionNote ?? null}
        reviewerName={data?.review ? data.review.reviewerName : (data?.expectedReviewerName ?? null)}
        weeksScored={data?.month.weeksScored ?? 0}
        monthLabel={formatReviewPeriod(period)}
      />
    </div>
  );
}
