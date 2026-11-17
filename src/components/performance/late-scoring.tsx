import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Panel } from "@/components/performance/dashboard-widgets";
import type { WeekStatus } from "@/services/performance/late";
import { cn } from "@/lib/utils";

type Tone = "ok" | "late" | "open" | "muted";
const TONE: Record<Tone, string> = {
  ok: "bg-success-subtle text-success",
  late: "bg-destructive-subtle text-destructive",
  open: "bg-warning-subtle text-warning",
  muted: "bg-muted text-muted-foreground",
};
const toneOf = (w: WeekStatus, scored: number, total: number): Tone =>
  w.upcoming ? "muted" : scored >= total ? "ok" : w.overdue ? "late" : "open";

/**
 * Week-by-week scoring overview for a month. Three views, all visible at once:
 * each week's progress; for weeks with gaps, who still has to score whom,
 * department by department; and a department × week grid.
 */
export function WeeklyScoring({
  weeks,
  viewerUserId,
  period,
  monthLabel,
  className,
}: {
  className?: string;
  weeks: WeekStatus[];
  viewerUserId: string;
  /** "2026-10" */
  period: string;
  monthLabel: string;
}) {
  if (weeks.length === 0 || weeks[0].total === 0) return null;
  const late = weeks.filter((w) => w.overdue && w.missing.length > 0);
  const pending = weeks.filter((w) => !w.upcoming && w.missing.length > 0);
  const departments = weeks[0].byDepartment.map((d) => d.department);

  return (
    <Panel className={cn("mt-6 p-0", className)}>
      <div className="flex items-start gap-3 p-5 pb-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            late.length ? "bg-destructive-subtle text-destructive" : "bg-brand-subtle text-brand"
          )}
        >
          <CalendarClock className="size-4" />
        </span>
        <div>
          <p className="font-semibold">Weekly scoring · {monthLabel}</p>
          <p className="text-sm text-muted-foreground">
            {late.length
              ? `${late.length} finished ${late.length === 1 ? "week has" : "weeks have"} people not scored, listed below with who has to score them.`
              : pending.length === 0
                ? "All caught up: every week so far is scored."
                : "Weeks run Monday to Saturday."}
          </p>
        </div>
      </div>

      {/* Each week's progress */}
      <div className={cn("grid gap-2 border-t border-border p-5 sm:grid-cols-2", weeks.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        {weeks.map((w) => {
          const tone = toneOf(w, w.scored, w.total);
          const missing = w.total - w.scored;
          return (
            <div key={w.week} className="rounded-xl bg-muted/60 px-3 py-2.5">
              <p className="text-sm font-semibold">
                Week {w.week} <span className="font-normal text-muted-foreground">· {w.range}</span>
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {w.scored} / {w.total}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", TONE[tone])}>
                  {tone === "ok" ? "Done" : tone === "muted" ? "Upcoming" : `${missing} pending${tone === "late" ? " · late" : ""}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Who still has to score whom */}
      {pending.length > 0 && (
        <div className="space-y-4 border-t border-border p-5">
          <p className="text-metadata">Pending: whose side it&apos;s on</p>
          {pending.map((w) => (
            <div key={w.week}>
              <p className="mb-2 text-sm font-semibold">
                Week {w.week} <span className="font-normal text-muted-foreground">· {w.range}</span>
                {w.overdue && <span className="ml-2 rounded-full bg-destructive-subtle px-2 py-0.5 text-xs text-destructive">late</span>}
              </p>
              <div className="space-y-2">
                {w.missing.map((d) => (
                  <div key={d.department} className="rounded-xl border border-border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {d.department} · {d.count} pending
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {d.scorers.map((m) => {
                        const mine = m.scorerUserId === viewerUserId;
                        return (
                          <li key={m.scorerUserId} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                            <span className="font-medium">{mine ? "You" : m.scorerName}</span>
                            <span className="text-muted-foreground">
                              to score {m.people.length} {m.people.length === 1 ? "employee" : "employees"}:
                            </span>
                            {m.people.map((p) => (
                              <Link
                                key={p.employeeId}
                                href={
                                  mine
                                    ? `/performance/score?employee=${p.employeeId}&period=${period}&week=${w.week}`
                                    : `/performance/people/${p.employeeId}?period=${period}`
                                }
                                className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium hover:text-brand"
                              >
                                {p.name}
                              </Link>
                            ))}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Department × week: only worth it with more than one department in view. */}
      {departments.length > 1 && (
      <div className="overflow-x-auto border-t border-border">
        <table className="data-table min-w-[560px]">
          <thead>
            <tr>
              <th className="pl-5">Department</th>
              {weeks.map((w) => (
                <th key={w.week} className="text-center">
                  Week {w.week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept}>
                <td className="pl-5 font-medium">{dept}</td>
                {weeks.map((w) => {
                  const d = w.byDepartment.find((x) => x.department === dept);
                  if (!d) return <td key={w.week} />;
                  return (
                    <td key={w.week} className="text-center">
                      <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", TONE[toneOf(w, d.scored, d.total)])}>
                        {d.scored} / {d.total}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </Panel>
  );
}
