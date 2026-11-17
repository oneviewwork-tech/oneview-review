"use client";

import { useState } from "react";
import { Building2, Check, Target, Users, X } from "lucide-react";
import { Panel } from "@/components/performance/dashboard-widgets";
import { formatPoints } from "@/components/performance/score-meter";
import { gradeOf, type GradeSettings } from "@/domain/performance/grading";
import { cn } from "@/lib/utils";

export interface OverviewMonth {
  label: string;
  current: boolean;
  /** Everyone with a scorecard that month; score is out of 100, null when not (confirmed) scored. */
  people: { department: string; score: number | null }[];
}

/**
 * The company's own targets for a healthy month, as in HR's sheet: the
 * overall average at or above 80, and the A/B/C mix within these shares of
 * the people scored.
 */
const TARGETS = { overall: 80, a: [20, 25] as const, b: [60, 70] as const, cBelow: 15 };

const fmt = (n: number) => formatPoints(Math.round(n * 100) / 100);
const share = (n: number) => `${Math.round(n * 10) / 10}%`;

/** Chip colour for a score out of 100: green strong, amber middle, red weak. */
const heat = (score: number | null) =>
  score == null
    ? "text-muted-foreground"
    : score >= 85
      ? "bg-success-subtle text-success"
      : score >= 80
        ? "bg-success-subtle/60 text-success"
        : score >= 70
          ? "bg-warning-subtle text-warning"
          : "bg-destructive-subtle text-destructive";

type Tab = "headcount" | "targets" | "departments";

/**
 * Company overview, month by month — HR's spreadsheet tables, as one card
 * with tabs: headcount and the A/B/C split with the average; how each month
 * stood against the targets; and every department's score.
 */
export function CompanyOverview({ months, settings }: { months: OverviewMonth[]; settings: GradeSettings }) {
  const [tab, setTab] = useState<Tab>("headcount");

  const stats = months.map((m) => {
    const scored = m.people.filter((p): p is { department: string; score: number } => p.score != null);
    const count = (g: "A" | "B" | "C") => scored.filter((p) => gradeOf(p.score, settings) === g).length;
    const pctOf = (n: number) => (scored.length ? (n / scored.length) * 100 : null);
    const depts = new Map<string, number[]>();
    for (const p of scored) depts.set(p.department, [...(depts.get(p.department) ?? []), p.score]);
    return {
      total: m.people.length,
      scored: scored.length,
      a: count("A"),
      b: count("B"),
      c: count("C"),
      avg: scored.length ? scored.reduce((s, p) => s + p.score, 0) / scored.length : null,
      aShare: pctOf(count("A")),
      bShare: pctOf(count("B")),
      cShare: pctOf(count("C")),
      dept: new Map([...depts].map(([d, xs]) => [d, xs.reduce((s, x) => s + x, 0) / xs.length])),
    };
  });
  const departments = [...new Set(months.flatMap((m) => m.people.map((p) => p.department)))].sort((x, y) => x.localeCompare(y));

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "headcount", label: "Headcount & scores", icon: Users },
    { key: "targets", label: "Against targets", icon: Target },
    { key: "departments", label: "Departments", icon: Building2 },
  ];


  const current = months.findIndex((m) => m.current);
  const dash = <span className="text-muted-foreground">-</span>;

  const target = (v: number | null, ok: (v: number) => boolean, text: (v: number) => string) =>
    v == null ? (
      dash
    ) : ok(v) ? (
      <Pill className="bg-success-subtle text-success">
        <Check className="size-3.5" /> {text(v)}
      </Pill>
    ) : (
      <Pill className="bg-destructive-subtle text-destructive">
        <X className="size-3.5" /> {text(v)}
      </Pill>
    );

  return (
    <Panel className="mt-5 p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 p-6 pb-4">
        <div>
          <p className="text-eyebrow">Company overview</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Month by month</h2>
          <p className="text-sm text-muted-foreground">Confirmed months only. The tinted column is the month you&apos;re viewing.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1" role="tablist" aria-label="Overview">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-ui",
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-1 pb-4">
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[34%]" />
            {months.map((m) => (
              <col key={m.label} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card py-2.5 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tab === "departments" ? "Department" : "Metric"}
              </th>
              {months.map((m) => (
                <th
                  key={m.label}
                  className={cn(
                    "px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide",
                    m.current ? "rounded-t-2xl bg-brand-subtle/50 text-brand" : "text-muted-foreground"
                  )}
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr>td]:border-t [&>tr>td]:border-border">
            {tab === "headcount" && (
              <>
                <Row current={current} label="Total employees" cells={stats.map((s) => <span key="t" className="font-semibold tabular-nums">{s.total}</span>)} />
                <Row
                  current={current}
                  label="A players"
                  hint={`High Performer · ≥ ${settings.gradeA}`}
                  cells={stats.map((s) => <Pill key="a" className="bg-success-subtle text-success">{s.a}</Pill>)}
                />
                <Row
                  current={current}
                  label="B players"
                  hint={`Stable Performer · ${settings.gradeB}–${settings.gradeA - 1}`}
                  cells={stats.map((s) => <Pill key="b" className="bg-brand-subtle text-brand">{s.b}</Pill>)}
                />
                <Row
                  current={current}
                  label="C players"
                  hint={`Needs Improvement · < ${settings.gradeB}`}
                  cells={stats.map((s) => <Pill key="c" className="bg-destructive-subtle text-destructive">{s.c}</Pill>)}
                />
                <Row
                  current={current}
                  label={<span className="font-semibold">Avg company score</span>}
                  hint="out of 100"
                  cells={stats.map((s) =>
                    s.avg == null ? (
                      dash
                    ) : (
                      <span key="avg" className="inline-flex flex-col items-center gap-1">
                        <span className="text-base font-semibold tabular-nums">{fmt(s.avg)}</span>
                        <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
                          <span className={cn("block h-full rounded-full", s.avg >= 85 ? "bg-success" : s.avg >= 70 ? "bg-brand" : "bg-destructive")} style={{ width: `${Math.min(100, s.avg)}%` }} />
                        </span>
                      </span>
                    )
                  )}
                />
              </>
            )}

            {tab === "targets" && (
              <>
                <Row
                  current={current}
                  label="Overall company score"
                  hint={`Target ≥ ${TARGETS.overall}`}
                  cells={stats.map((s) => target(s.avg, (v) => v >= TARGETS.overall, fmt))}
                />
                <Row
                  current={current}
                  label="A players"
                  hint={`Target ${TARGETS.a[0]}–${TARGETS.a[1]}% of people scored`}
                  cells={stats.map((s) => target(s.aShare, (v) => v >= TARGETS.a[0] && v <= TARGETS.a[1], share))}
                />
                <Row
                  current={current}
                  label="B players"
                  hint={`Target ${TARGETS.b[0]}–${TARGETS.b[1]}%`}
                  cells={stats.map((s) => target(s.bShare, (v) => v >= TARGETS.b[0] && v <= TARGETS.b[1], share))}
                />
                <Row
                  current={current}
                  label="C players"
                  hint={`Target below ${TARGETS.cBelow}%`}
                  cells={stats.map((s) => target(s.cShare, (v) => v < TARGETS.cBelow, share))}
                />
              </>
            )}

            {tab === "departments" &&
              (departments.length === 0 ? (
                <tr>
                  <td colSpan={months.length + 1} className="px-5 py-8 text-center text-muted-foreground">
                    No departments in view.
                  </td>
                </tr>
              ) : (
                departments.map((d) => (
                  <Row
                    current={current}
                    key={d}
                    label={<span className="font-semibold">{d}</span>}
                    cells={stats.map((s) => {
                      const v = s.dept.get(d) ?? null;
                      return v == null ? dash : <Pill key={d} className={heat(v)}>{fmt(v)}</Pill>;
                    })}
                  />
                ))
              ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** One row: a label cell, then one cell per month (the viewed month, `current`, tinted). */
function Row({ label, hint, cells, current }: { label: React.ReactNode; hint?: string; cells: React.ReactNode[]; current: number }) {
  return (
    <tr className="group">
      <td className="sticky left-0 z-10 bg-card py-3 pl-5 pr-3 group-hover:bg-muted/40">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </td>
      {cells.map((c, i) => (
        <td key={i} className={cn("px-2 py-3 text-center group-hover:bg-muted/40", i === current && "bg-brand-subtle/50 group-hover:bg-brand-subtle/70")}>
          {c}
        </td>
      ))}
    </tr>
  );
}

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex min-w-12 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums", className)}>
      {children}
    </span>
  );
}
