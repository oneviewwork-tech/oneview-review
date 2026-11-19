import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarCheck, ClipboardCheck, Download, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button-variants";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/shared/avatar";
import { PeriodFilter } from "@/components/hr/period-filter";
import { ScopeFilter } from "@/components/hr/scope-filter";
import { ReviewStatusBadge } from "@/components/performance/review-status-badge";
import { ScoreMeter, formatPoints } from "@/components/performance/score-meter";
import { SendRemindersButton } from "@/components/performance/workflow-actions";
import { GradeSettingsDialog } from "@/components/performance/grade-settings-dialog";
import { MonthTrend, SheetReport, type TrendPoint } from "@/components/performance/sheet-report";
import { AdminBoard, type ActionItem, type DeptCard } from "@/components/performance/admin-board";
import { CompanyOverview } from "@/components/performance/company-overview";
import { photoUrlFor } from "@/services/people/photo";
import { getGradeSettings } from "@/services/performance/settings";
import {
  BreakdownPanel,
  HeroCard,
  KraPanel,
  Panel,
  ProgressPill,
  RankList,
  StatBubble,
  StatusList,
  greeting,
  type BreakdownItem,
} from "@/components/performance/dashboard-widgets";
import { getPerformanceAccess, canScore } from "@/services/performance/access";
import { confirmedScoresOnly, getKraRollup, getPersonPerformance, getTeamRows, type TeamRow } from "@/services/performance/data";
import { WeeklyScoring } from "@/components/performance/late-scoring";
import { getWeeklyScoring } from "@/services/performance/late";
import { getScoringTodo } from "@/services/notifications/in-app";
import { ScoringTodo } from "@/components/performance/scoring-todo";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";
import { canEditScores, mayDecide, type ReviewState } from "@/domain/performance/workflow";
import { groupBy, partPercents, percentOf, scoreGroup, viewerLevel, type RollupRow } from "@/domain/performance/rollup";
import { formatPeriodValue, formatReviewPeriod, parseReviewPeriod, selectablePeriods } from "@/domain/review/period";
import { cn } from "@/lib/utils";
import { bandOf } from "@/domain/performance/grading";

const ATTENTION_BELOW = 70;

const toRollup = (r: TeamRow): RollupRow => ({
  employeeId: r.employeeId,
  average: r.average,
  maxTotal: r.maxTotal,
  organizationName: r.organizationName,
  departmentName: r.departmentName,
  scorerUserId: r.scorerUserId,
  scorerName: r.scorerName,
});

export default async function PerformanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; org?: string; department?: string }>;
}) {
  const params = await searchParams;
  const periods = selectablePeriods(12);
  const period = (params.period && parseReviewPeriod(params.period)) || periods[0];
  const periodValue = formatPeriodValue(period);
  const periodOptions = periods.map((p) => ({ value: formatPeriodValue(p), label: formatReviewPeriod(p) }));
  const prevPeriod = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() - 1, 1));

  // The organization list is only used by HR/Admin, but it is independent of
  // the access lookup, so it is fetched alongside it rather than after.
  const [access, organizations] = await Promise.all([getPerformanceAccess(), getScopeOrganizations()]);
  // An ordinary employee has no team to look at: this page is their scorecard.
  // They land on the most recent month HR has confirmed, since that is the
  // first one with scores they are allowed to see.
  if (access.selfOnly) {
    if (!access.selfEmployeeId) {
      return (
        <EmptyState
          className="mt-8"
          title="Your account isn't linked to an employee record yet"
          description="Ask HR to check that your People login email matches your employee record."
        />
      );
    }
    const latest = params.period
      ? null
      : await prisma.perfReview.findFirst({
          where: { employeeId: access.selfEmployeeId, status: "CONFIRMED" },
          orderBy: { period: "desc" },
          select: { period: true },
        });
    const target = params.period ?? (latest ? formatPeriodValue(latest.period) : null);
    redirect(`/performance/people/${access.selfEmployeeId}${target ? `?period=${target}` : ""}`);
  }

  const visibleIds = access.visibleEmployeeIds ? [...access.visibleEmployeeIds] : null;
  // Everyone else sees only their own team, so the filter is HR/Admin's.
  const scope = access.isStaff ? resolveScope(organizations, params) : {};

  // Someone who scores at least one person (so not selfOnly) still has their
  // own scorecard to check, but the dashboard's own `period` defaults to the
  // current month, which usually isn't confirmed yet - that would make "My
  // own result" read as "not scored" even when last month's real, confirmed
  // score is sitting right there. Default their own panel to their latest
  // confirmed month instead, same as the selfOnly redirect above; an
  // explicit ?period= (so they can still pick August or September) applies
  // to both the team view and their own panel together.
  const myPeriod =
    !params.period && access.selfEmployeeId
      ? await prisma.perfReview
          .findFirst({ where: { employeeId: access.selfEmployeeId, status: "CONFIRMED" }, orderBy: { period: "desc" }, select: { period: true } })
          .then((r) => r?.period ?? period)
      : period;
  const myPeriodValue = formatPeriodValue(myPeriod);

  // Four independent reads, asked together: this month, last month (for the
  // change), the KRA picture, and the viewer's own scorecard.
  // HR/Admin also get the month-by-month trend (two more months back) and
  // the grade cut-offs; both are asked together with everything else.
  // The chart shows four months and stays anchored on the latest one, so after
  // you click an earlier month the later ones are still there to click back to.
  // It only moves when you go further back than the window reaches.
  const latest = periods[0];
  const windowEnd = period.getTime() >= Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - 3, 1) ? latest : period;
  const windowMonths = access.isStaff
    ? [3, 2, 1, 0].map((n) => new Date(Date.UTC(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth() - n, 1)))
    : [];
  // Months already loaded are reused; only the rest are fetched.
  const extra = windowMonths.filter((m) => m.getTime() !== period.getTime() && m.getTime() !== prevPeriod.getTime());
  // Only confirmed months carry numbers here (see confirmedScoresOnly).
  const confirmed = (p: Promise<TeamRow[]>) => p.then(confirmedScoresOnly);
  const [allRows, prevRows, kras, mine, settings, extraRows, late, todo] = await Promise.all([
    confirmed(getTeamRows(visibleIds, period, scope)),
    confirmed(getTeamRows(visibleIds, prevPeriod, scope)),
    getKraRollup(visibleIds, period, scope),
    access.selfEmployeeId ? getPersonPerformance(access.selfEmployeeId, myPeriod) : Promise.resolve(null),
    getGradeSettings(),
    Promise.all(extra.map((p) => confirmed(getTeamRows(visibleIds, p, scope)))),
    // Week-by-week scoring for the month in view.
    getWeeklyScoring(visibleIds, scope, access.selfEmployeeId, period),
    // Only for people who score someone.
    access.scoredEmployeeIds.length > 0 ? getScoringTodo(access.user.id) : Promise.resolve(null),
  ]);
  const loaded = new Map<number, typeof allRows>([
    [period.getTime(), allRows],
    [prevPeriod.getTime(), prevRows],
    ...extra.map((p, i) => [p.getTime(), extraRows[i]] as [number, typeof allRows]),
  ]);
  const trend: TrendPoint[] = windowMonths.map((p) => {
    const g = scoreGroup("m", "m", (loaded.get(p.getTime()) ?? []).filter((x) => x.employeeId !== access.selfEmployeeId).map(toRollup));
    const value = formatPeriodValue(p);
    // Same view, different month: the organization/department filter is kept.
    const q = new URLSearchParams({
      period: value,
      ...(scope.organizationId ? { org: scope.organizationId } : {}),
      ...(scope.departmentId ? { department: scope.departmentId } : {}),
    });
    return {
      label: p.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      percent: g.percent,
      people: g.scored,
      href: `/performance?${q.toString()}`,
      current: value === periodValue,
    };
  });
  const rows = allRows.filter((r) => r.employeeId !== access.selfEmployeeId);
  const prior = prevRows.filter((r) => r.employeeId !== access.selfEmployeeId);

  // ── The numbers ────────────────────────────────────────────────────
  const rollup = rows.map(toRollup);
  const total = scoreGroup("all", "All", rollup);
  const priorTotal = scoreGroup("prior", "Prior", prior.map(toRollup));
  const delta = total.percent != null && priorTotal.percent != null ? total.percent - priorTotal.percent : null;

  const scored = rows.filter((r) => r.weeksScored > 0);
  const pending = rows.length - scored.length;
  const split = partPercents(rows);
  // The same, as average points over the people scored ("46.5 / 60").
  const splitPoints = (() => {
    const s = rows.filter((r) => r.weeksScored > 0 && r.performance != null && r.potential != null);
    if (s.length === 0) return { performance: "-", potential: "-" };
    const avg = (pick: (r: (typeof s)[number]) => number) => Math.round((s.reduce((a, r) => a + pick(r), 0) / s.length) * 10) / 10;
    return {
      performance: `${formatPoints(avg((r) => r.performance!))} / ${formatPoints(avg((r) => r.performanceMax))}`,
      potential: `${formatPoints(avg((r) => r.potential!))} / ${formatPoints(avg((r) => r.potentialMax))}`,
    };
  })();
  const weeksEntered = rows.reduce((s, r) => s + r.weeksScored, 0);
  const byState = (s: ReviewState) => rows.filter((r) => r.reviewState === s).length;
  const pct = (n: number, of: number) => (of === 0 ? 0 : (n / of) * 100);

  const ranked = scored
    .map((r) => ({ r, percent: percentOf(r) }))
    .filter((x): x is { r: TeamRow; percent: number } => x.percent !== null);
  const attention = ranked.filter((x) => x.percent < ATTENTION_BELOW).sort((a, b) => a.percent - b.percent);
  const leaders = [...ranked].sort((a, b) => b.percent - a.percent).slice(0, 5);
  const personHref = (r: TeamRow) => `/performance/people/${r.employeeId}?period=${periodValue}`;

  const reportPeople = rows.map((r) => ({
    id: r.employeeId,
    name: r.name,
    meta: r.departmentName === r.templateName ? r.departmentName : `${r.departmentName} · ${r.templateName}`,
    department: r.departmentName,
    percent: percentOf(r),
    state: r.reviewState,
    href: personHref(r),
  }));
  const toRank = ({ r, percent }: { r: TeamRow; percent: number }) => ({
    id: r.employeeId,
    name: r.name,
    meta: `${r.departmentName} · ${r.templateName}`,
    percent,
    href: personHref(r),
  });

  // ── Who is looking, and so what total they are looking at ──────────
  const level = viewerLevel(access.isStaff, access.user.id, rollup);
  const orgName = organizations.find((o) => o.id === scope.organizationId)?.name;
  const deptName = organizations.flatMap((o) => o.departments).find((d) => d.id === scope.departmentId)?.name;
  const heroName =
    level === "organization"
      ? [orgName ?? "All organizations", deptName].filter(Boolean).join(" · ")
      : level === "department"
        ? "Your department"
        : "Your team";

  const multipleOrgs = new Set(rollup.map((r) => r.organizationName)).size > 1;
  const toItems = (g: ReturnType<typeof groupBy>, hint?: (key: string) => string | undefined): BreakdownItem[] =>
    g.map((x) => ({ ...x, hint: hint?.(x.key) }));
  const orgGroups = groupBy(rollup, (r) => r.organizationName);
  const deptGroups = groupBy(
    rollup,
    (r) => `${r.organizationName}|${r.departmentName}`,
    (r) => r.departmentName
  );
  const teamGroups = groupBy(
    rollup,
    (r) => r.scorerUserId,
    (r) => `${r.scorerName}'s team`
  );
  const sections = [
    ...(level === "organization" && orgGroups.length > 1 ? [{ title: "By organization", items: toItems(orgGroups) }] : []),
    ...(level !== "team" && deptGroups.length > 1
      ? [{ title: "By department", items: toItems(deptGroups, multipleOrgs ? (k) => k.split("|")[0] : undefined) }]
      : []),
    ...(level !== "team" && teamGroups.length > 1 ? [{ title: "By team", items: toItems(teamGroups) }] : []),
  ];

  const waitingForMe = allRows.filter((r) => r.reviewState === "SUBMITTED" && mayDecide({ id: access.user.id, canDecideAny: access.canDecideAny }, r.reviewerUserId)).length;
  const unassigned = access.isStaff
    ? await prisma.employee.count({
        where: {
          isActive: true,
          perfAssignment: null,
          ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
          ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
        },
      })
    : 0;

  const statusItems = [...rows]
    .sort((a, b) => Number(a.weeksScored > 0) - Number(b.weeksScored > 0) || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((r) => ({
      id: r.employeeId,
      name: r.name,
      meta: r.weeksScored > 0 ? `${r.templateName} · avg ${r.average}` : `${r.templateName} · not scored yet`,
      scored: r.weeksScored > 0,
    }));

  const exportParams = new URLSearchParams({
    period: periodValue,
    ...(scope.organizationId ? { org: scope.organizationId } : {}),
    ...(scope.departmentId ? { department: scope.departmentId } : {}),
  });
  const firstName = access.user.name.split(/\s+/)[0];
  const levelCopy = {
    organization: "How everyone with a scorecard is doing: organization, department, team and person.",
    department: "How your department is doing: each team and each person in it.",
    team: "How your team is doing, and each person in it.",
  }[level];

  // ── HR / Admin board ──────────────────────────────────────────────
  // The best confirmed score in each department (just one when a department is selected).
  const bestByDept = new Map<string, { r: TeamRow; percent: number }>();
  for (const x of ranked) {
    const key = `${x.r.organizationName}|${x.r.departmentName}`;
    const cur = bestByDept.get(key);
    if (!cur || x.percent > cur.percent) bestByDept.set(key, x);
  }
  const topList = [...bestByDept.values()].sort((a, b) => b.percent - a.percent);
  const topPerformers = access.isStaff
    ? await Promise.all(
        topList.map(async (x) => ({
          name: x.r.name,
          meta: x.r.designation ?? x.r.departmentName,
          department: x.r.departmentName,
          score: x.percent,
          href: personHref(x.r),
          photoUrl: await photoUrlFor(x.r.employeeId),
        }))
      )
    : [];
  // Per department: score, members, and which weeks still wait for a score, by whom.
  const deptCards: DeptCard[] = (() => {
    const cards = new Map<string, DeptCard>();
    for (const r of rows) {
      const key = `${r.organizationName}|${r.departmentName}`;
      const card = cards.get(key) ?? { key, label: r.departmentName, organization: r.organizationName, people: 0, scored: 0, score: null, members: [], pending: [] };
      card.people++;
      if (r.weeksScored > 0) card.scored++;
      card.members.push({ id: r.employeeId, name: r.name, score: percentOf(r), href: personHref(r) });
      cards.set(key, card);
    }
    for (const g of deptGroups) {
      const c = cards.get(g.key);
      if (c) c.score = g.percent;
    }
    for (const w of late) {
      if (w.upcoming) continue;
      for (const d of w.missing) {
        for (const c of cards.values()) {
          if (c.label !== d.department) continue;
          c.pending.push({
            week: w.week,
            range: w.range,
            late: w.overdue,
            count: d.count,
            scorers: d.scorers.map((sc) => ({
              name: sc.scorerName,
              people: sc.people.map((p) => ({ id: p.employeeId, name: p.name, href: `/performance/people/${p.employeeId}?period=${periodValue}` })),
            })),
          });
        }
      }
    }
    // Departments with late weeks first, then by score.
    return [...cards.values()].sort(
      (x, y) =>
        y.pending.filter((p) => p.late).length - x.pending.filter((p) => p.late).length ||
        (y.score ?? -1) - (x.score ?? -1) ||
        x.label.localeCompare(y.label)
    );
  })();
  const lateWeeks = late.filter((w) => w.overdue && w.missing.length > 0);
  const adminActions: ActionItem[] = [
    ...(lateWeeks.length
      ? lateWeeks.slice(0, 3).map((w) => ({
          key: `late-${w.week}`,
          title: `Week ${w.week} not fully scored`,
          detail: `${w.total - w.scored} employee${w.total - w.scored === 1 ? "" : "s"} · ${w.missing.length} department${w.missing.length === 1 ? "" : "s"}`,
          href: `/performance?period=${periodValue}`,
          done: false,
          icon: "late" as const,
        }))
      : [{ key: "late", title: "Weekly scores up to date", detail: "No finished week is missing scores", href: `/performance/score?period=${periodValue}`, done: true, icon: "late" as const }]),
    {
      key: "review",
      title: byState("SUBMITTED") ? `${byState("SUBMITTED")} awaiting review` : "Nothing awaiting review",
      detail: "Submitted, waiting for the department head",
      href: `/performance/reviews?period=${periodValue}&tab=with`,
      done: byState("SUBMITTED") === 0,
      icon: "review",
    },
    {
      key: "back",
      title: byState("NEEDS_REVISION") ? `${byState("NEEDS_REVISION")} sent back` : "Nothing sent back",
      detail: "Waiting for the scorer to resubmit",
      href: `/performance/reviews?period=${periodValue}&tab=sent`,
      done: byState("NEEDS_REVISION") === 0,
      icon: "back",
    },
    {
      key: "assign",
      title: unassigned ? `${unassigned} without a scorecard` : "Everyone has a scorecard",
      detail: "Active employees not yet assigned",
      href: "/performance/assignments?filter=unassigned",
      done: unassigned === 0,
      icon: "assign",
    },
  ];

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {formatReviewPeriod(period)} · {levelCopy}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {access.isStaff && <ScopeFilter organizations={organizations} />}
          <PeriodFilter periods={periodOptions} />
          {rows.length > 0 && (
            <a
              href={`/performance/export?${exportParams.toString()}`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}
              title="Download what you're looking at as a spreadsheet"
            >
              <Download className="size-4" /> Export
            </a>
          )}
          {access.isStaff && <GradeSettingsDialog settings={settings} />}
          {access.isStaff && <SendRemindersButton period={periodValue} />}
        </div>
      </div>

      {waitingForMe > 0 && (
        <Link
          href={`/performance/reviews?period=${periodValue}`}
          className="mt-6 flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm text-ink-foreground shadow-sm transition-ui hover:shadow-md"
        >
          <ClipboardCheck className="size-4" />
          <span>
            <strong>{waitingForMe}</strong> {waitingForMe === 1 ? "submission is" : "submissions are"} waiting for your review, open them
          </span>
        </Link>
      )}

      {todo && <ScoringTodo items={todo} />}

      {!access.isStaff && (
        <WeeklyScoring weeks={late} viewerUserId={access.user.id} period={periodValue} monthLabel={formatReviewPeriod(period)} />
      )}

      {!access.isStaff && rows.length > 0 && (
        <div className="mt-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="flex w-full flex-1 flex-wrap items-end gap-4 sm:w-auto sm:gap-6">
            <ProgressPill className="w-full sm:w-52" label="Scored this month" percent={pct(scored.length, rows.length)} display={`${scored.length} of ${rows.length}`} tone="violet" />
            <ProgressPill className="w-full sm:w-44" label="Not scored yet" percent={pct(pending, rows.length)} display={`${pending} of ${rows.length}`} tone="pink" />
            <ProgressPill className="w-full sm:w-52" label="Average score" percent={total.percent ?? 0} display={total.percent == null ? "-" : `${formatPoints(total.percent)} / 100`} tone="blue" />
          </div>
          <div className="flex flex-wrap gap-x-9 gap-y-4">
            <StatBubble icon={Users} value={rows.length} label="People" tint="violet" />
            <StatBubble icon={CalendarCheck} value={weeksEntered} label="Weeks scored" tint="pink" />
            <StatBubble icon={AlertTriangle} value={attention.length} label={`Below ${ATTENTION_BELOW}`} tint="blue" />
          </div>
        </div>
      )}


      {mine && mine.version && (
        <Panel className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-metadata">
              My own result · {mine.template.name}
              {/* Only shown when this panel's month differs from the team dashboard above, so it never reads as a mismatch. */}
              {myPeriodValue !== periodValue && <> · {formatReviewPeriod(myPeriod)}</>}
            </p>
            {/* Your own number is never shown, only the band — and only once the month is confirmed. */}
            {(() => {
              const final = mine.review?.finalScore ?? mine.month.average;
              if (mine.reviewState !== "CONFIRMED" || final == null || mine.maxTotal === 0) {
                return <p className="mt-1.5 text-sm text-muted-foreground">Shown once {formatReviewPeriod(myPeriod)} is confirmed.</p>;
              }
              const band = bandOf((final / mine.maxTotal) * 100, settings);
              return (
                <p className="mt-1.5 text-sm">
                  <span className="font-semibold">{band.label}</span>
                  <span className="text-muted-foreground"> · {band.range} band</span>
                </p>
              );
            })()}
            <p className="mt-1 text-xs text-muted-foreground">Scored by {mine.scorer.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <ReviewStatusBadge state={mine.reviewState} />
            <Link
              href={`/performance/people/${mine.employee.id}?period=${myPeriodValue}`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}
            >
              View my scorecard
            </Link>
          </div>
        </Panel>
      )}

      {!access.isStaff && scored.length > 0 && (
        <Panel className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div>
              <p className="text-lg font-semibold">Performance &amp; Potential</p>
              <p className="text-sm text-muted-foreground">Every scorecard splits 60 points of Performance and 40 of Potential.</p>
            </div>
            <div className="flex w-full flex-wrap gap-4 sm:w-auto sm:gap-6">
              <ProgressPill className="w-full sm:w-56" label="Performance" percent={split.performance ?? 0} display={splitPoints.performance} tone="violet" />
              <ProgressPill className="w-full sm:w-56" label="Potential" percent={split.potential ?? 0} display={splitPoints.potential} tone="pink" />
            </div>
          </div>
        </Panel>
      )}

      {rows.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={access.isStaff ? "No scorecards in this view" : "You don't score anyone yet"}
          description={
            access.isStaff
              ? "Try another organization or department, or assign scorecards under Setup → Assignments."
              : "When HR assigns people to you, they will appear here."
          }
        />
      ) : access.isStaff ? (
        <>
        <AdminBoard
          periodValue={periodValue}
          counts={{
            people: rows.length,
            scored: scored.length,
            draft: byState("DRAFT"),
            submitted: byState("SUBMITTED"),
            sentBack: byState("NEEDS_REVISION"),
            confirmed: byState("CONFIRMED"),
            departments: deptGroups.length,
          }}
          average={total.percent}
          delta={delta}
          performance={splitPoints.performance}
          potential={splitPoints.potential}
          tops={topPerformers}
          weeks={late}
          departments={deptCards}
          actions={adminActions}
          report={<SheetReport title={heroName} settings={settings} people={reportPeople} />}
          side={<MonthTrend trend={trend} />}
        />
        <CompanyOverview
          settings={settings}
          months={windowMonths.map((p) => ({
            label: p.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
            current: p.getTime() === period.getTime(),
            people: (loaded.get(p.getTime()) ?? [])
              .filter((r) => r.employeeId !== access.selfEmployeeId)
              .map((r) => ({ department: r.departmentName, score: percentOf(toRollup(r)) })),
          }))}
        />
        </>
      ) : (
        <>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <HeroCard
              icon={level === "team"}
              name={heroName}
              subtitle={`${rows.length} ${rows.length === 1 ? "person" : "people"} · ${scored.length} scored`}
              score={total.percent}
              max={100}
              caption={level === "team" ? "team score" : level === "department" ? "department score" : "overall score"}
              delta={delta}
            />

            {level === "team" ? (
              <Panel>
                <p className="text-lg font-semibold">How the team is doing</p>
                <p className="text-sm text-muted-foreground">Scored people by month score (out of 100)</p>
                <div className="mt-5 space-y-4">
                  {(
                    [
                      ["A · High Performer (≥ 85)", ranked.filter((x) => x.percent >= 85).length, "violet"],
                      ["B · Stable Performer (70–84)", ranked.filter((x) => x.percent >= 70 && x.percent < 85).length, "blue"],
                      [`C · Needs Improvement (< ${ATTENTION_BELOW})`, attention.length, "pink"],
                    ] as const
                  ).map(([label, n, tone]) => (
                    <ProgressPill
                      key={label}
                      label={label}
                      percent={pct(n, ranked.length)}
                      display={`${n} ${n === 1 ? "person" : "people"}`}
                      tone={tone}
                    />
                  ))}
                </div>
              </Panel>
            ) : (
              <BreakdownPanel
                title={level === "organization" ? "Scores by level" : "Teams in your department"}
                subtitle={
                  level === "organization"
                    ? "Each group's score, best first. Use the filters to focus on one organization or department."
                    : "Each team's score, best first."
                }
                sections={sections}
              />
            )}

            <StatusList title="Scored this month" done={scored.length} total={rows.length} items={statusItems} />
          </div>

          {/* The two short lists stack beside the KRA panel, so the row's height balances. */}
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="flex flex-col gap-5">
              <RankList
                className="flex-1"
                title="Top performers"
                subtitle="Highest scores this month"
                items={leaders.map(toRank)}
                empty="Nothing scored yet this month."
              />
              <RankList
                className="flex-1"
                title="Needs attention"
                subtitle={`Lowest scores, below ${ATTENTION_BELOW} / 100`}
                items={attention.slice(0, 5).map(toRank)}
                empty={ranked.length === 0 ? "Nothing scored yet this month." : `No one is below ${ATTENTION_BELOW}.`}
              />
            </div>
            <KraPanel className="lg:col-span-2" items={kras.slice(0, 5)} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["DRAFT", "SUBMITTED", "NEEDS_REVISION", "CONFIRMED"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm shadow-sm">
                <ReviewStatusBadge state={s} />
                <strong className="tabular-nums">{byState(s)}</strong>
              </span>
            ))}
          </div>

          <Panel className="mt-3 overflow-x-auto p-0">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th className="pl-6">Person</th>
                  <th>Scorecard</th>
                  <th>Scored by</th>
                  <th>Weeks</th>
                  <th>Month average</th>
                  <th>Performance</th>
                  <th>Potential</th>
                  <th>Last week</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td className="pl-6">
                      <Link href={personHref(r)} className="flex items-center gap-2.5 hover:text-brand">
                        <Avatar name={r.name} />
                        <span className="leading-tight">
                          <span className="block font-medium">{r.name}</span>
                          <span className="block text-xs text-muted-foreground">{r.designation ?? r.departmentName}</span>
                        </span>
                      </Link>
                    </td>
                    <td>{r.templateName}</td>
                    <td className="text-muted-foreground">{r.scorerName}</td>
                    <td className={cn("tabular-nums", r.weeksScored === 0 && "text-muted-foreground")}>{r.weeksScored}</td>
                    <td>
                      <ScoreMeter score={r.average} max={r.maxTotal} />
                    </td>
                    <td className="tabular-nums">
                      {r.performance != null ? `${r.performance} / ${r.performanceMax}` : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="tabular-nums">
                      {r.potential != null ? `${r.potential} / ${r.potentialMax}` : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="tabular-nums">{r.lastWeekTotal ?? "-"}</td>
                    <td>
                      <ReviewStatusBadge state={r.reviewState} />
                    </td>
                    <td className="pr-6 text-right">
                      {canScore(access, r.employeeId) && canEditScores(r.reviewState) && (
                        <Link
                          href={`/performance/score?employee=${r.employeeId}&period=${periodValue}`}
                          className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}
                        >
                          Score
                        </Link>
                      )}
                      {/* For someone who doesn't score this person: say what the month is waiting on. */}
                      {!canScore(access, r.employeeId) && canEditScores(r.reviewState) && (
                        <span className="text-xs text-muted-foreground">
                          {r.weeksScored > 0 ? `Waiting for ${r.scorerName} to submit` : `${r.scorerName} hasn't scored yet`}
                        </span>
                      )}
                      {r.reviewState === "SUBMITTED" && mayDecide({ id: access.user.id, canDecideAny: access.canDecideAny }, r.reviewerUserId) && (
                        <Link
                          href={`/performance/reviews?period=${periodValue}`}
                          className={buttonVariants({ size: "sm", className: "rounded-full" })}
                        >
                          Review
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
