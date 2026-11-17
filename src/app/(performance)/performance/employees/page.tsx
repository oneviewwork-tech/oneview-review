import Link from "next/link";
import { ArrowLeft, Building2, ChevronRight, Users } from "lucide-react";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilter } from "@/components/hr/period-filter";
import { Panel } from "@/components/performance/dashboard-widgets";
import { getPerformanceAccess } from "@/services/performance/access";
import { confirmedScoresOnly, getTeamRows, type TeamRow } from "@/services/performance/data";
import { getGradeSettings } from "@/services/performance/settings";
import { getScopeOrganizations } from "@/services/review/scope";
import { percentOf } from "@/domain/performance/rollup";
import { gradeOf, type Grade } from "@/domain/performance/grading";
import { formatPeriodValue, parseReviewPeriod, selectablePeriods } from "@/domain/review/period";
import { cn } from "@/lib/utils";
import { ManagerRatings, type RatedPerson } from "@/components/performance/manager-ratings";

const MONTHS = 6;

/** A level read from the designation, as HR's sheet shows it. */
function levelOf(designation: string | null): string | null {
  const d = (designation ?? "").toLowerCase();
  if (/intern|trainee/.test(d)) return "Intern";
  if (/\b(junior|jr)\b/.test(d)) return "Junior";
  if (/\b(senior|sr)\b/.test(d)) return "Senior";
  if (/head|manager|\blead\b/.test(d)) return "Lead";
  if (/executive|\bexe\b/.test(d)) return "Executive";
  return null;
}
/** Cell fill for a score out of 100, as in HR's sheet: deep green to orange. */
const heat = (score: number) =>
  score >= 90 ? "bg-[#57bb8a] text-black" : score >= 85 ? "bg-[#9fce63] text-black" : score >= 80 ? "bg-[#e2e868] text-black" : score >= 70 ? "bg-[#f7cb4d] text-black" : "bg-[#f19a6b] text-black";
const GRADE_CELL: Record<Grade, string> = {
  A: "bg-[#b7e1cd] text-[#0b5a3a]",
  B: "bg-[#fce8b2] text-[#7a5200]",
  C: "bg-[#f4c7c3] text-[#8a1c12]",
};
const LEVEL_CELL: Record<string, string> = {
  Intern: "bg-muted",
  Junior: "bg-[#fff2cc]",
  Executive: "bg-[#dbeaf7]",
  Senior: "bg-[#e6dff5]",
  Lead: "bg-[#d9d2e9]",
};
const fmt = (n: number) => n.toFixed(2);
const monthLabel = (p: Date) => p.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

/**
 * Employee Performance: pick a department, then see everyone in it month by
 * month — confirmed score and grade per month, their level, and the
 * department average underneath. HR's sheet, live.
 */
export default async function EmployeePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; period?: string }>;
}) {
  await requirePermission("PERF_VIEW_ALL");
  const params = await searchParams;
  const [access, organizations, settings] = await Promise.all([getPerformanceAccess(), getScopeOrganizations(), getGradeSettings()]);
  const visibleIds = access.visibleEmployeeIds ? [...access.visibleEmployeeIds] : null;

  const periods = selectablePeriods(12);
  const latestConfirmed = params.period
    ? null
    : await prisma.perfReview.findFirst({ where: { status: "CONFIRMED" }, orderBy: { period: "desc" }, select: { period: true } });
  const end =
    (params.period && parseReviewPeriod(params.period)) ||
    (latestConfirmed && latestConfirmed.period.getTime() <= periods[0].getTime() ? latestConfirmed.period : periods[0]);
  const months = Array.from({ length: MONTHS }, (_, i) => new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (MONTHS - 1 - i), 1)));
  const periodOptions = periods.map((p) => ({ value: formatPeriodValue(p), label: `Up to ${monthLabel(p).replace(" ", " 20")}` }));

  const department = organizations.flatMap((o) => o.departments.map((d) => ({ ...d, organization: o.name }))).find((d) => d.id === params.department);

  // ── Step 1: choose a department ────────────────────────────────────
  if (!department) {
    const latest = confirmedScoresOnly(await getTeamRows(visibleIds, end));
    const statsFor = (orgName: string, deptName: string) => {
      const rows = latest.filter((r) => r.organizationName === orgName && r.departmentName === deptName);
      const scores = rows.map(percentOf).filter((x): x is number => x != null);
      return { people: rows.length, avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null };
    };
    return (
      <div className="animate-fade-up">
        <PageHeader
          title="Employee Performance"
          description="Pick a department to see everyone in it month by month: confirmed score, grade and level."
          actions={<PeriodFilter periods={periodOptions} />}
        />
        <div className="mt-6 space-y-8">
          {organizations.map((o) => (
            <section key={o.id}>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="size-4" /> {o.name}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {o.departments.map((d) => {
                  const s = statsFor(o.name, d.name);
                  return (
                    <Link
                      key={d.id}
                      href={`/performance/employees?department=${d.id}${params.period ? `&period=${params.period}` : ""}`}
                      className="group flex items-center justify-between gap-3 rounded-[1.4rem] bg-card p-5 shadow-sm ring-1 ring-black/5 transition-ui hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{d.name}</span>
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="size-3.5" /> {s.people} {s.people === 1 ? "person" : "people"}
                          {s.avg != null && (
                            <>
                              {" · "}
                              <span className="font-semibold text-foreground">{fmt(s.avg)}</span> in {monthLabel(end)}
                            </>
                          )}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2: the department, month by month ─────────────────────────
  // Leavers are included: their months stay in the history, struck through.
  const byMonth = await Promise.all(
    months.map((m) => getTeamRows(visibleIds, m, { departmentId: department.id, includeLeavers: true }).then(confirmedScoresOnly))
  );
  const people = new Map<string, { row: TeamRow; scores: (number | null)[] }>();
  byMonth.forEach((rows, i) => {
    for (const r of rows) {
      const entry = people.get(r.employeeId) ?? { row: r, scores: Array(MONTHS).fill(null) };
      entry.row = r;
      entry.scores[i] = percentOf(r);
      people.set(r.employeeId, entry);
    }
  });
  // A leaver with nothing in the window isn't worth a row.
  const list = [...people.values()]
    .filter((p) => p.row.isActive || p.scores.some((s) => s != null))
    .map((p) => {
      const got = p.scores.filter((x): x is number => x != null);
      return { ...p, avg: got.length ? got.reduce((a, b) => a + b, 0) / got.length : null };
    })
    // As in the sheet: current people first, best first; leavers at the bottom.
    .sort((a, b) => Number(b.row.isActive) - Number(a.row.isActive) || (b.avg ?? -1) - (a.avg ?? -1) || a.row.name.localeCompare(b.row.name));
  const monthAvg = months.map((_, i) => {
    const got = list.filter((p) => p.row.isActive).map((p) => p.scores[i]).filter((x): x is number => x != null);
    return got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
  });
  const ratingRows = await prisma.managerRating.findMany({
    where: { period: { gte: months[0], lte: end }, rater: { departmentId: department.id } },
    orderBy: { createdAt: "desc" },
    select: { stars: true, message: true, period: true, ratedAs: true, targetUserId: true, target: { select: { name: true } }, rater: { select: { name: true } } },
  });
  const rated = new Map<string, RatedPerson>();
  for (const r of ratingRows) {
    const p = rated.get(r.targetUserId) ?? { userId: r.targetUserId, name: r.target.name, roles: [], ratings: [] };
    const role = r.ratedAs === "SCORER" ? "Manager" : "Head";
    if (!p.roles.includes(role)) p.roles.push(role);
    p.ratings.push({ stars: r.stars, message: r.message, rater: r.rater.name, month: monthLabel(r.period) });
    rated.set(r.targetUserId, p);
  }
  const ratedPeople = [...rated.values()].sort((a, b) => b.ratings.length - a.ratings.length || a.name.localeCompare(b.name));

  const monthName = (p: Date) => p.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const head = "border border-white/15 bg-ink px-2 py-2 text-center text-xs font-bold whitespace-nowrap text-ink-foreground";
  const cell = "border border-border px-2.5 py-2 whitespace-nowrap";
  const short = (p: Date) => p.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

  // Headline figures for the last month in view, against the one before.
  const last = MONTHS - 1;
  const lastScores = list.filter((p) => p.row.isActive).map((p) => p.scores[last]).filter((x): x is number => x != null);
  const counts = { A: 0, B: 0, C: 0 } as Record<Grade, number>;
  for (const x of lastScores) counts[gradeOf(x, settings)]++;
  const delta = monthAvg[last] != null && monthAvg[last - 1] != null ? monthAvg[last]! - monthAvg[last - 1]! : null;
  const gradeCounts = (i: number) => {
    const c = { A: 0, B: 0, C: 0 } as Record<Grade, number>;
    for (const p of list) if (p.row.isActive && p.scores[i] != null) c[gradeOf(p.scores[i]!, settings)]++;
    return c;
  };

  return (
    <div className="animate-fade-up">
      <Link
        href={`/performance/employees${params.period ? `?period=${params.period}` : ""}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All departments
      </Link>
      <PageHeader
        className="mt-2"
        eyebrow={department.organization}
        title={department.name}
        description={`${list.filter((p) => p.row.isActive).length} people · confirmed scores, ${monthName(months[0])} to ${monthName(end)} ${end.getUTCFullYear()}`}
        actions={<PeriodFilter periods={periodOptions} />}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-[1.4rem] bg-ink p-4 text-ink-foreground shadow-sm">
          <p className="text-xs opacity-70">Average · {monthName(end)}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{monthAvg[last] == null ? "-" : fmt(monthAvg[last]!)}</p>
          <p className="text-xs opacity-70">
            {delta == null ? "no earlier month to compare" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(2)} vs ${monthName(months[last - 1])}`}
          </p>
        </div>
        <div className="rounded-[1.4rem] bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Scored · {monthName(end)}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {lastScores.length}
            <span className="text-base font-normal text-muted-foreground"> / {list.filter((p) => p.row.isActive).length}</span>
          </p>
        </div>
        {(["A", "B", "C"] as const).map((g) => (
          <div key={g} className={cn("rounded-[1.4rem] p-4 shadow-sm", GRADE_CELL[g])}>
            <p className="text-xs font-medium opacity-80">
              {g} · {g === "A" ? "High Performer" : g === "B" ? "Stable Performer" : "Needs Improvement"}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{counts[g]}</p>
          </div>
        ))}
      </div>

      <Panel className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr>
                <th rowSpan={2} className={cn(head, "sticky left-0 z-10 px-3 text-left")}>
                  Employee
                </th>
                <th rowSpan={2} className={cn(head, "px-3 text-left")}>
                  Role
                </th>
                <th rowSpan={2} className={head}>
                  Level
                </th>
                <th colSpan={MONTHS} className={cn(head, "tracking-wide")}>
                  Score
                </th>
                <th colSpan={MONTHS} className={cn(head, "tracking-wide")}>
                  Grade
                </th>
              </tr>
              <tr>
                {[...months, ...months].map((m, i) => (
                  <th key={i} className={cn(head, "font-semibold", m.getTime() === end.getTime() && "bg-brand")}>
                    {short(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3 + MONTHS * 2} className="px-5 py-10 text-center text-muted-foreground">
                    Nobody in this department has a scorecard.
                  </td>
                </tr>
              ) : (
                list.map((p) => {
                  const level = levelOf(p.row.designation);
                  const left = !p.row.isActive;
                  const strike = left && "text-muted-foreground line-through";
                  return (
                    <tr key={p.row.employeeId} className="hover:brightness-[0.97]">
                      <td className={cn(cell, "sticky left-0 z-10 bg-card font-medium")}>
                        <Link href={`/performance/people/${p.row.employeeId}?period=${formatPeriodValue(end)}`} className={cn("hover:text-brand", strike)}>
                          {p.row.name}
                          {left && " (EXIT)"}
                        </Link>
                      </td>
                      <td className={cn(cell, "text-muted-foreground", strike)}>{p.row.designation ?? "-"}</td>
                      <td className={cn(cell, "text-center font-medium", level && !left ? LEVEL_CELL[level] : "", strike)}>{level ?? "-"}</td>
                      {p.scores.map((s, i) => (
                        <td key={`s${i}`} className={cn(cell, "text-center font-medium tabular-nums", s == null && "bg-muted/30", s != null && !left && heat(s), s != null && left && "bg-muted/60", strike)}>
                          {s == null ? "" : fmt(s)}
                        </td>
                      ))}
                      {p.scores.map((s, i) => {
                        const g = s == null ? null : gradeOf(s, settings);
                        return (
                          <td key={`g${i}`} className={cn(cell, "text-center font-semibold", g && !left && GRADE_CELL[g], left && "text-muted-foreground")}>
                            {g ?? (left ? "NA" : "")}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="sticky left-0 z-10 border border-white/15 bg-ink px-3 py-2.5 text-sm font-bold uppercase text-ink-foreground">
                    Average
                  </td>
                  {monthAvg.map((a, i) => (
                    <td key={i} className={cn(cell, "text-center font-bold tabular-nums", a != null && heat(a))}>
                      {a == null ? "" : fmt(a)}
                    </td>
                  ))}
                  {months.map((_, i) => {
                    const c = gradeCounts(i);
                    const any = c.A + c.B + c.C > 0;
                    return (
                      <td key={`gc${i}`} className="border border-white/15 bg-ink px-1.5 py-2 text-center text-[11px] font-semibold text-ink-foreground">
                        {any ? (
                          <span className="inline-flex gap-1">
                            {(["A", "B", "C"] as const).map((g) =>
                              c[g] ? (
                                <span key={g} className={cn("rounded px-1", GRADE_CELL[g])}>
                                  {c[g]}
                                  {g}
                                </span>
                              ) : null
                            )}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#57bb8a]" /> 90+
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#9fce63]" /> 85–89
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#e2e868]" /> 80–84
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#f7cb4d]" /> 70–79
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-[#f19a6b]" /> below 70
        </span>
        <span>
          · Grades: A {settings.gradeA}+, B {settings.gradeB}–{settings.gradeA - 1}, C below {settings.gradeB} · Only confirmed months are shown.
        </span>
      </div>
      <ManagerRatings people={ratedPeople} windowLabel={`${monthLabel(months[0])} to ${monthLabel(end)}`} />
    </div>
  );
}
