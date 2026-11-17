"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleDashed, TrendingUp, Trophy, Users, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { ReviewStatusBadge } from "@/components/performance/review-status-badge";
import { Panel, toneClass } from "@/components/performance/dashboard-widgets";
import { formatPoints } from "@/components/performance/score-meter";
import { GRADE_LABEL, HEALTH_LABEL, gradeOf, gradeRange, healthOf, type Grade, type GradeSettings, type Health } from "@/domain/performance/grading";
import { cn } from "@/lib/utils";
import type { ReviewState } from "@/domain/performance/workflow";

export interface ReportPerson {
  id: string;
  name: string;
  meta: string;
  /** For the report's department filter. */
  department: string;
  percent: number | null;
  state: ReviewState;
  href: string;
}

export interface TrendPoint {
  label: string;
  percent: number | null;
  people: number;
  /** The dashboard for this month, with the current filters. */
  href: string;
  /** The month being viewed. */
  current: boolean;
}

const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-success-subtle text-success ring-success/20",
  B: "bg-brand-subtle text-brand ring-brand/20",
  C: "bg-destructive-subtle text-destructive ring-destructive/20",
};
const HEALTH_STYLE: Record<Health, string> = {
  HIGH: "bg-success-subtle text-success",
  STABLE: "bg-brand-subtle text-brand",
  IMPROVING: "bg-warning-subtle text-warning",
  AT_RISK: "bg-destructive-subtle text-destructive",
};

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-sm font-bold ring-1 ring-inset", GRADE_STYLE[grade])}>
      {grade}
    </span>
  );
}

type Filter = "ALL" | Grade | "UNSCORED";

/**
 * The report HR and Admin work from. The headline cards — everyone, A, B,
 * C, not scored — are filters: pick one and the people in it appear below,
 * ranked. Nothing is listed until a card is picked, so the board stays a
 * summary. Grades use the cut-offs HR has set.
 */
export function SheetReport({
  title,
  settings,
  people: allPeople,
}: {
  title: string;
  settings: GradeSettings;
  people: ReportPerson[];
}) {
  const [filter, setFilter] = useState<Filter | null>(null);
  const departments = [...new Set(allPeople.map((p) => p.department))].sort((a, b) => a.localeCompare(b));
  const [dept, setDept] = useState("all");
  const people = dept === "all" ? allPeople : allPeople.filter((p) => p.department === dept);

  const scored = people.filter((p): p is ReportPerson & { percent: number } => p.percent !== null).sort((a, b) => b.percent - a.percent);
  const unscored = people.filter((p) => p.percent === null);
  const average = scored.length ? scored.reduce((s, p) => s + p.percent, 0) / scored.length : null;
  const health = average == null ? null : healthOf(average, settings);
  const byGrade = (g: Grade) => scored.filter((p) => gradeOf(p.percent, settings) === g);

  const range = (g: Grade) => gradeRange(g, settings);

  const cards: {
    key: Filter;
    grade?: Grade;
    label: string;
    sub: string;
    list: ReportPerson[];
    icon: LucideIcon;
    /** Card surface (soft gradient wash). */
    className: string;
    /** Number, icon chip and share bar colour. */
    accent: string;
    chip: string;
    bar: string;
  }[] = [
    {
      key: "ALL",
      label: "Everyone",
      sub: `${scored.length} scored · ${unscored.length} not yet`,
      list: [...scored, ...unscored],
      icon: Users,
      className: "bg-ink text-ink-foreground",
      accent: "text-ink-foreground",
      chip: "bg-white/12 text-ink-foreground",
      bar: "bg-white/70",
    },
    {
      key: "A",
      grade: "A",
      label: GRADE_LABEL.A,
      sub: range("A"),
      list: byGrade("A"),
      icon: Trophy,
      className: "bg-gradient-to-br from-success-subtle via-success-subtle/70 to-card",
      accent: "text-success",
      chip: "bg-success text-white",
      bar: "bg-success",
    },
    {
      key: "B",
      grade: "B",
      label: GRADE_LABEL.B,
      sub: range("B"),
      list: byGrade("B"),
      icon: TrendingUp,
      className: "bg-gradient-to-br from-brand-subtle via-brand-subtle/70 to-card",
      accent: "text-brand",
      chip: "bg-brand text-brand-foreground",
      bar: "bg-brand",
    },
    {
      key: "C",
      grade: "C",
      label: GRADE_LABEL.C,
      sub: range("C"),
      list: byGrade("C"),
      icon: AlertTriangle,
      className: "bg-gradient-to-br from-destructive-subtle via-destructive-subtle/70 to-card",
      accent: "text-destructive",
      chip: "bg-destructive text-white",
      bar: "bg-destructive",
    },
    {
      key: "UNSCORED",
      label: "Not scored",
      sub: "no score this month",
      list: unscored,
      icon: CircleDashed,
      className: "bg-gradient-to-br from-muted via-muted/60 to-card",
      accent: "text-foreground",
      chip: "bg-ink/10 text-foreground",
      bar: "bg-ink/40",
    },
  ];
  const everyone = people.length || 1;
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0])
      .join("")
      .toUpperCase();
  const active = cards.find((c) => c.key === filter) ?? null;

  return (
    <div>
      <Panel className="p-6">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-eyebrow">Performance review report</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight">{dept === "all" ? title : dept}</h2>
              </div>
              {departments.length > 1 && (
                <Dropdown
                  className="w-56"
                  value={dept}
                  onChange={(v) => {
                    setDept(v);
                    setFilter(null);
                  }}
                  options={[{ value: "all", label: "All departments" }, ...departments.map((d) => ({ value: d, label: d }))]}
                />
              )}
            </div>
            {/* Where everyone sits, A to not scored, in one bar. */}
            <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Grade distribution">
              {cards
                .filter((c) => c.key !== "ALL" && c.list.length > 0)
                .map((c) => (
                  <span key={c.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", c.bar)} style={{ width: `${(c.list.length / everyone) * 100}%` }} />
                ))}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {cards
                .filter((c) => c.key !== "ALL")
                .map((c) => (
                  <li key={c.key} className="flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", c.bar)} />
                    {c.grade ? `${c.grade} · ` : ""}
                    {c.label} <strong className="text-foreground tabular-nums">{c.list.length}</strong>
                  </li>
                ))}
            </ul>
          </div>
          <div className="flex items-center gap-4 rounded-[1.4rem] bg-muted/60 p-4 pr-6">
            <AverageRing value={average} />
            <div>
              <p className="text-xs font-medium text-muted-foreground">Average score</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {average == null ? "-" : formatPoints(Math.round(average * 10) / 10)}
                <span className="text-sm font-normal text-muted-foreground"> / 100</span>
              </p>
              {health && <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", HEALTH_STYLE[health])}>{HEALTH_LABEL[health]}</span>}
            </div>
          </div>
        </div>

        {/* The cards are the filters. */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="tablist" aria-label="Show people">
          {cards.map((c) => {
            const on = c.key === filter;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(on ? null : c.key)}
                className={cn(
                  "group relative flex min-h-44 flex-col overflow-hidden rounded-[1.5rem] p-4 text-left shadow-sm ring-1 ring-black/5 transition-ui hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  c.className,
                  on && "-translate-y-1 shadow-lg ring-2 ring-ink"
                )}
              >
                {/* Soft decorative glow in the corner. */}
                <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-white/30 blur-2xl" />
                <span className="relative flex items-start justify-between gap-2">
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", c.chip)}>
                    {c.grade ? <span className="text-sm font-bold">{c.grade}</span> : <c.icon className="size-4" />}
                  </span>
                  <span className={cn("flex size-7 items-center justify-center rounded-full transition-ui", on ? "bg-ink text-ink-foreground" : "bg-black/5 group-hover:bg-black/10", c.key === "ALL" && !on && "bg-white/10")}>
                    <ChevronRight className={cn("size-4 transition-transform", on && "rotate-90")} />
                  </span>
                </span>
                <span className="relative mt-3 block text-sm font-semibold leading-tight">{c.label}</span>
                <span className={cn("relative block text-xs", c.key === "ALL" ? "opacity-70" : "text-muted-foreground")}>{c.sub}</span>
                <span className="relative mt-auto flex items-end justify-between gap-2 pt-3">
                  <span className={cn("text-4xl font-semibold leading-none tabular-nums tracking-tight", c.accent)}>{c.list.length}</span>
                  {c.list.length > 0 && (
                    <span className="flex -space-x-2">
                      {c.list.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          title={p.name}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full text-[10px] font-bold ring-2",
                            c.key === "ALL" ? "bg-white/15 text-ink-foreground ring-ink" : "bg-card text-foreground ring-white"
                          )}
                        >
                          {initials(p.name)}
                        </span>
                      ))}
                      {c.list.length > 3 && (
                        <span className={cn("flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2", c.key === "ALL" ? "bg-white/25 ring-ink" : "bg-muted ring-white")}>
                          +{c.list.length - 3}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                {/* Share of everyone. */}
                <span className={cn("relative mt-3 block h-1 overflow-hidden rounded-full", c.key === "ALL" ? "bg-white/15" : "bg-black/5")}>
                  <span className={cn("block h-full rounded-full", c.bar)} style={{ width: `${(c.list.length / everyone) * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>

        {/* The people behind the picked card. */}
        {active ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <p className="font-semibold">
                {active.label} <span className="font-normal text-muted-foreground">· {active.list.length}</span>
              </p>
              <button type="button" onClick={() => setFilter(null)} className="text-sm text-muted-foreground hover:text-foreground">
                Hide
              </button>
            </div>
            {active.list.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">Nobody here this month.</p>
            ) : (
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th className="pl-5">Rank</th>
                    <th>Name</th>
                    <th>Final score</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th className="pr-5">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {active.list.map((p) => {
                    const grade = p.percent == null ? null : gradeOf(p.percent, settings);
                    const rank = p.percent == null ? null : scored.findIndex((s) => s.id === p.id) + 1;
                    return (
                      <tr key={p.id}>
                        <td className="pl-5 tabular-nums text-muted-foreground">{rank ?? "-"}</td>
                        <td>
                          <Link href={p.href} className="flex items-center gap-2.5 hover:text-brand">
                            <Avatar name={p.name} />
                            <span className="leading-tight">
                              <span className="block font-medium">{p.name}</span>
                              <span className="block text-xs text-muted-foreground">{p.meta}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="font-semibold tabular-nums">
                          {p.percent == null ? (
                            <span className="font-normal text-muted-foreground">not scored</span>
                          ) : (
                            <>
                              {formatPoints(Math.round(p.percent * 10) / 10)} <span className="font-normal text-muted-foreground">/ 100</span>
                            </>
                          )}
                        </td>
                        <td>{grade ? <GradeBadge grade={grade} /> : "-"}</td>
                        <td>
                          <ReviewStatusBadge state={p.state} />
                        </td>
                        <td className="pr-5">
                          <div className="h-2.5 w-36 overflow-hidden rounded-full bg-muted" aria-hidden>
                            {p.percent != null && <div className={cn("h-full rounded-full", toneClass(p.percent))} style={{ width: `${Math.min(100, p.percent)}%` }} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <p className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground">
            <Users className="size-4" /> Pick a card to see the people in it
          </p>
        )}
      </Panel>

    </div>
  );
}

/** Average score by month; click a month to open it. Hidden until there are two months to compare. */
export function MonthTrend({ trend: allTrend }: { trend: TrendPoint[] }) {
  // Months before anything was scored are just empty bars, so start at the first real one.
  const firstScored = allTrend.findIndex((t) => t.percent !== null);
  const trend = firstScored < 0 ? [] : allTrend.slice(firstScored);
  if (trend.length < 2) return null;
  return (
      <Panel>
        <p className="text-lg font-semibold">Month by month</p>
        <p className="text-sm text-muted-foreground">Average score for everyone in view. Click a month to open it.</p>
        <div className="mt-4 flex items-end gap-4" role="img" aria-label="Average score by month">
          {trend.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              aria-current={t.current ? "page" : undefined}
              title={`Show ${t.label}`}
              className={cn(
                "group flex flex-1 flex-col items-center gap-1.5 rounded-2xl px-2 py-2 transition-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                t.current && "bg-brand-subtle"
              )}
            >
              <span className="text-sm font-semibold tabular-nums">{t.percent == null ? "-" : formatPoints(Math.round(t.percent * 10) / 10)}</span>
              <div className="flex h-24 w-full max-w-14 items-end rounded-xl bg-muted">
                {t.percent != null && (
                  <div className={cn("w-full rounded-xl", toneClass(t.percent))} style={{ height: `${Math.max(4, Math.min(100, t.percent))}%` }} />
                )}
              </div>
              <span className={cn("text-xs", t.current ? "font-semibold text-brand" : "text-muted-foreground group-hover:text-foreground")}>{t.label}</span>
            </Link>
          ))}
        </div>
      </Panel>
  );
}


/** A small ring filled to the average (out of 100). */
function AverageRing({ value }: { value: number | null }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const fill = value == null ? 0 : Math.min(1, value / 100) * c;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-card" />
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-brand" strokeDasharray={`${fill} ${c}`} transform="rotate(-90 32 32)" strokeLinecap="round" />
    </svg>
  );
}
