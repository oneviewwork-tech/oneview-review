import Link from "next/link";
import { ArrowUpRight, Building2, CheckCircle2, ChevronDown, CircleAlert, Clock, Inbox, Layers, Link2, Undo2, Users } from "lucide-react";
import { formatPoints } from "@/components/performance/score-meter";
import type { WeekStatus } from "@/services/performance/late";
import { cn } from "@/lib/utils";

export interface DeptCard {
  key: string;
  label: string;
  organization: string;
  people: number;
  scored: number;
  /** Average out of 100; null while nobody is scored. */
  score: number | null;
  members: { id: string; name: string; score: number | null; href: string }[];
  /** Weeks this department still owes scores for: which week, how many, who has to submit. */
  pending: {
    week: number;
    range: string;
    late: boolean;
    count: number;
    scorers: { name: string; people: { id: string; name: string; href: string }[] }[];
  }[];
}

export interface ActionItem {
  key: string;
  title: string;
  detail: string;
  href: string;
  done: boolean;
  icon: "late" | "review" | "back" | "assign";
}

const ACTION_ICON = { late: Clock, review: Inbox, back: Undo2, assign: Link2 } as const;

/** A rounded bento tile. */
function Tile({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[1.75rem] bg-card p-6 shadow-sm", className)} {...props} />;
}

function CornerLink({ href, label, dark }: { href: string; label: string; dark?: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full transition-ui hover:scale-105",
        dark ? "bg-white/10 text-white hover:bg-white/20" : "bg-muted hover:bg-accent"
      )}
    >
      <ArrowUpRight className="size-4" />
    </Link>
  );
}

const fmt = (n: number) => formatPoints(Math.round(n * 10) / 10);
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
const tone = (score: number | null) =>
  score == null ? "bg-muted" : score >= 85 ? "bg-success" : score >= 70 ? "bg-brand" : "bg-destructive";

/**
 * The HR / Admin dashboard as a bento board: a status strip and headline
 * figures, then tiles — best performer, week-by-week progress, the average,
 * the approval pipeline with what needs doing, departments — and the
 * detailed report and scoring panels underneath.
 */
export function AdminBoard({
  periodValue,
  counts,
  average,
  delta,
  performance,
  potential,
  tops,
  weeks,
  departments,
  actions,
  report,
  side,
}: {
  periodValue: string;
  counts: { people: number; scored: number; draft: number; submitted: number; sentBack: number; confirmed: number; departments: number };
  average: number | null;
  delta: number | null;
  performance: string;
  potential: string;
  /** Best confirmed score per department (one entry when a department is selected). */
  tops: { name: string; meta: string; department: string; score: number; href: string; photoUrl?: string }[];
  weeks: WeekStatus[];
  departments: DeptCard[];
  actions: ActionItem[];
  report: React.ReactNode;
  side: React.ReactNode;
}) {
  const strip = [
    { key: "confirmed", label: "Confirmed", n: counts.confirmed, cls: "bg-ink text-ink-foreground" },
    { key: "submitted", label: "In review", n: counts.submitted, cls: "bg-brand text-brand-foreground" },
    {
      key: "draft",
      label: "Being scored",
      n: counts.draft,
      cls: "bg-card text-foreground [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(120_100_200/0.14)_6px_10px)]",
    },
    { key: "back", label: "Sent back", n: counts.sentBack, cls: "border-2 border-ink/60 bg-transparent" },
  ];
  const doneActions = actions.filter((a) => a.done).length;
  const pipelineTotal = counts.draft + counts.submitted + counts.sentBack + counts.confirmed || 1;

  return (
    <div className="mt-8">
      {/* ── Status strip + headline figures ─────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3 lg:flex-nowrap">
          {strip.map((s) => (
            <div key={s.key} className="min-w-28" style={{ flexGrow: Math.max(1, s.n) }}>
              <p className="mb-2 text-sm font-medium text-muted-foreground">{s.label}</p>
              <span className={cn("flex h-11 items-center rounded-full px-4 text-sm font-semibold tabular-nums", s.cls)}>{s.n}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-8 sm:gap-10">
          {[
            { icon: Users, value: counts.people, label: "People" },
            { icon: CheckCircle2, value: counts.scored, label: "Scored" },
            { icon: Building2, value: counts.departments, label: "Departments" },
          ].map((f) => (
            <div key={f.label} className="flex items-end gap-2">
              <span className="mb-1.5 flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm">
                <f.icon className="size-4" />
              </span>
              <span>
                <span className="block text-5xl font-semibold leading-none tabular-nums tracking-tight sm:text-6xl">{f.value}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{f.label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bento ───────────────────────────────────────────────── */}
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Top performers: the best of each department, or of the one in view */}
        {tops.length === 1 ? (
          <Tile className="relative flex min-h-72 flex-col justify-end overflow-hidden bg-ink p-6 text-white">
            {tops[0].photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own authed thumbnail route
              <img src={tops[0].photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center pb-20 text-7xl font-bold tracking-tight text-white/15">
                {initialsOf(tops[0].name)}
              </span>
            )}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <p className="absolute left-6 top-6 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">Top performer · {tops[0].department}</p>
            <Link href={tops[0].href} className="relative flex items-end justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-2xl font-semibold leading-tight">{tops[0].name}</span>
                <span className="block truncate text-sm opacity-75">{tops[0].meta}</span>
              </span>
              <span className="shrink-0 rounded-full border border-white/60 px-4 py-2 text-lg font-semibold tabular-nums">{fmt(tops[0].score)}</span>
            </Link>
          </Tile>
        ) : (
          <Tile className="flex min-h-72 flex-col bg-ink p-5 text-ink-foreground">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-lg font-semibold">Top performers</p>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">best of each department</span>
            </div>
            {tops.length === 0 ? (
              <p className="mt-auto px-1 text-sm opacity-70">Nobody is confirmed yet this month.</p>
            ) : (
              <ul className="mt-3 max-h-[15rem] space-y-1.5 overflow-y-auto pr-1">
                {tops.map((t, i) => (
                  <li key={t.href}>
                    <Link href={t.href} className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-ui hover:bg-white/10">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold", i === 0 ? "bg-chart-pink text-white" : "bg-white/10")}>
                        {t.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- our own authed thumbnail route
                          <img src={t.photoUrl} alt="" className="size-full object-cover" />
                        ) : (
                          initialsOf(t.name)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.name}</span>
                        <span className="block truncate text-xs opacity-60">{t.department}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums">{fmt(t.score)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tile>
        )}

        {/* Week by week */}
        <Tile className="flex min-h-72 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold">Progress</p>
              <p className="text-sm text-muted-foreground">Scored, week by week</p>
            </div>
            <CornerLink href={`/performance/score?period=${periodValue}`} label="Open Score Team" />
          </div>
          <div className="mt-auto flex items-end justify-around gap-2 pt-6">
            {weeks.map((w) => {
              const share = w.total ? w.scored / w.total : 0;
              const current = !w.upcoming && !w.overdue;
              return (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-2">
                  {/* Every week shows its count; the running week is highlighted. */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                      w.upcoming
                        ? "bg-muted text-muted-foreground"
                        : current
                          ? "bg-chart-pink text-white"
                          : w.overdue && share < 1
                            ? "bg-destructive-subtle text-destructive"
                            : "bg-ink/10 text-foreground"
                    )}
                  >
                    {w.upcoming ? "–" : `${w.scored}/${w.total}`}
                  </span>
                  <div className="flex h-28 w-2.5 items-end rounded-full bg-muted">
                    {/* No bar at all when nothing is scored, rather than a misleading stub. */}
                    {!w.upcoming && w.scored > 0 && (
                      <div
                        className={cn("w-full rounded-full", current ? "bg-chart-pink" : share >= 1 ? "bg-ink" : "bg-ink/60")}
                        style={{ height: `${Math.max(6, share * 100)}%` }}
                      />
                    )}
                  </div>
                  <span className={cn("size-1.5 rounded-full", w.overdue && share < 1 ? "bg-destructive" : "bg-ink/40")} />
                  <span className="text-xs text-muted-foreground">W{w.week}</span>
                </div>
              );
            })}
          </div>
        </Tile>

        {/* Average */}
        <Tile className="flex min-h-72 flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className="text-2xl font-semibold">Average score</p>
            <CornerLink href={`/performance/export?period=${periodValue}`} label="Download the report" />
          </div>
          <div className="flex flex-1 items-center justify-center py-2">
            <Gauge value={average} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="rounded-full bg-brand-subtle px-2.5 py-1 font-semibold text-brand">Perf {performance}</span>
            <span className="rounded-full bg-chart-pink/15 px-2.5 py-1 font-semibold text-chart-pink">Pot {potential}</span>
          </div>
          {delta != null && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {delta >= 0 ? "+" : ""}
              {fmt(delta)} vs last month
            </p>
          )}
        </Tile>

        {/* Pipeline + what needs doing */}
        <Tile className="flex flex-col gap-5 bg-[#ece8fb] p-5 xl:row-span-2">
          <div className="px-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-2xl font-semibold">Pipeline</p>
              <p className="text-3xl font-semibold tabular-nums">
                {counts.confirmed}
                <span className="text-base font-normal text-muted-foreground">/{counts.people}</span>
              </p>
            </div>
            <div className="mt-4 flex gap-1.5">
              {[
                { n: counts.confirmed, cls: "bg-success", label: "Confirmed" },
                { n: counts.submitted, cls: "bg-ink", label: "In review" },
                { n: counts.draft + counts.sentBack, cls: "bg-ink/30", label: "Open" },
              ]
                .filter((p) => p.n > 0)
                .map((p) => (
                  <div key={p.label} style={{ flexGrow: p.n }} className="min-w-12">
                    <p className="mb-1.5 text-xs font-medium">
                      {p.label} <span className="tabular-nums text-muted-foreground">{p.n}</span>
                    </p>
                    <div className={cn("h-10 rounded-2xl", p.cls)} title={`${Math.round((p.n / pipelineTotal) * 100)}%`} />
                  </div>
                ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col rounded-[1.5rem] bg-ink p-5 text-ink-foreground">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Needs doing</p>
              <p className="text-3xl font-semibold tabular-nums">
                {doneActions}/{actions.length}
              </p>
            </div>
            <ul className="mt-4 space-y-3">
              {actions.map((a) => {
                const Icon = ACTION_ICON[a.icon];
                return (
                  <li key={a.key}>
                    <Link href={a.href} className="group flex items-center gap-3">
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", a.done ? "bg-white/10" : "bg-white text-ink")}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-medium", a.done && "line-through opacity-50")}>{a.title}</span>
                        <span className="block truncate text-xs opacity-60">{a.detail}</span>
                      </span>
                      {a.done ? (
                        <CheckCircle2 className="size-5 shrink-0 text-chart-pink" />
                      ) : (
                        <CircleAlert className="size-5 shrink-0 opacity-40 group-hover:opacity-80" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </Tile>

        {/* Departments: who still has to score, which week, how many */}
        <Tile className="flex flex-col p-0 md:col-span-2 xl:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-3 p-6 pb-4">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">
                <Layers className="size-4 text-brand" /> Departments
              </p>
              <p className="text-sm text-muted-foreground">Average score, and which weeks are still waiting for a score, by whom.</p>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{departments.filter((d) => d.pending.length > 0).length}</span> of{" "}
              {departments.length} with pending weeks
            </p>
          </div>
          <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((d) => {
              const lateWeeks = d.pending.filter((p) => p.late).length;
              const waiting = new Set(d.pending.flatMap((p) => p.scorers.flatMap((sc) => sc.people.map((x) => x.id)))).size;
              return (
                <details key={d.key} className="group rounded-2xl border border-border bg-card open:shadow-sm">
                  <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{d.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {d.organization} · {d.scored}/{d.people} scored
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xl font-semibold leading-none tabular-nums">{d.score == null ? "-" : fmt(d.score)}</span>
                        <span className="text-[11px] text-muted-foreground">/ 100</span>
                      </span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className={cn("block h-full rounded-full", tone(d.score))} style={{ width: `${d.score ?? 0}%` }} />
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {d.pending.length === 0 ? (
                        <span className="rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-semibold text-success">All weeks scored</span>
                      ) : (
                        <>
                          {d.pending.map((p) => (
                            <span
                              key={p.week}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                                p.late ? "bg-destructive-subtle text-destructive" : "bg-warning-subtle text-warning"
                              )}
                            >
                              W{p.week} · {p.count}
                            </span>
                          ))}
                          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                            {waiting} waiting{lateWeeks ? ` · ${lateWeeks} late` : ""}
                            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                          </span>
                        </>
                      )}
                    </span>
                  </summary>
                  {d.pending.length > 0 && (
                    <ul className="space-y-3 border-t border-border px-4 py-3">
                      {d.pending.map((p) => (
                        <li key={p.week}>
                          <p className="text-xs font-semibold">
                            Week {p.week} <span className="font-normal text-muted-foreground">· {p.range}</span>
                            {p.late && <span className="ml-1.5 text-destructive">late</span>}
                          </p>
                          <ul className="mt-1.5 space-y-1.5">
                            {p.scorers.map((sc) => (
                              <li key={sc.name} className="text-sm">
                                <span className="font-medium">{sc.name}</span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {sc.people.length} {sc.people.length === 1 ? "employee" : "employees"}
                                </span>
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {sc.people.map((x) => (
                                    <Link key={x.id} href={x.href} className="rounded-full bg-muted px-2 py-0.5 text-xs hover:text-brand">
                                      {x.name}
                                    </Link>
                                  ))}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              );
            })}
          </div>
        </Tile>

        {/* The report, wide */}
        <div className="md:col-span-2 xl:col-span-4">{report}</div>
        <div className="md:col-span-2 xl:col-span-4 empty:hidden">{side}</div>
      </div>
    </div>
  );
}

/** A ring gauge out of 100, like a dial. */
function Gauge({ value }: { value: number | null }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  const arc = 0.78; // open at the bottom
  const fill = value == null ? 0 : Math.min(1, value / 100) * c * arc;
  return (
    <svg viewBox="0 0 150 150" className="size-40" role="img" aria-label={value == null ? "No average yet" : `Average ${value} out of 100`}>
      <circle cx="75" cy="75" r={r} fill="none" strokeWidth="14" className="stroke-muted" strokeDasharray={`${c * arc} ${c}`} transform="rotate(130 75 75)" strokeLinecap="round" />
      <circle cx="75" cy="75" r={r} fill="none" strokeWidth="14" className="stroke-brand" strokeDasharray={`${fill} ${c}`} transform="rotate(130 75 75)" strokeLinecap="round" />
      <text x="75" y="78" textAnchor="middle" className="fill-foreground text-[30px] font-semibold">
        {value == null ? "-" : fmt(value)}
      </text>
      <text x="75" y="98" textAnchor="middle" className="fill-muted-foreground text-[11px]">
        out of 100
      </text>
    </svg>
  );
}
