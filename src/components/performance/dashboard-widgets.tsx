import Link from "next/link";
import { Check, Circle, TrendingDown, TrendingUp, type LucideIcon, Users } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";
import { formatPoints } from "@/components/performance/score-meter";

/** The soft cards the dashboard is built from. */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[1.6rem] bg-card p-5 shadow-sm", className)} {...props} />;
}

type Tone = "violet" | "pink" | "blue";
const FILL: Record<Tone, string> = {
  violet: "bg-gradient-to-r from-brand to-[#8b6dff] text-white",
  pink: "bg-gradient-to-r from-chart-pink to-[#fb8fc5] text-white",
  blue: "bg-gradient-to-r from-chart-blue to-[#a9c6ff] text-ink",
};

/**
 * A labelled progress pill. `percent` sets the fill; `display` is what's
 * written in it — scores are shown as points ("46.5 / 60") and people as
 * counts ("3 of 8"), never as percentages.
 */
export function ProgressPill({
  label,
  percent,
  display,
  tone,
  className,
}: {
  label: string;
  percent: number;
  display: React.ReactNode;
  tone: Tone;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={cn("min-w-36", className)}>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-9 overflow-hidden rounded-full bg-muted [background-image:repeating-linear-gradient(135deg,transparent_0_5px,rgb(120_100_200/0.1)_5px_9px)]"
      >
        <div
          className={cn("flex h-full items-center rounded-full px-3.5 text-sm font-semibold tabular-nums", FILL[tone])}
          style={{ width: `max(${pct}%, 4.5rem)` }}
        >
          <span className="whitespace-nowrap">{display}</span>
        </div>
      </div>
    </div>
  );
}

/** A big number beside a soft round icon. */
export function StatBubble({ icon: Icon, value, label, tint }: { icon: LucideIcon; value: React.ReactNode; label: string; tint: Tone }) {
  const bg: Record<Tone, string> = {
    violet: "from-brand-subtle to-card text-brand",
    pink: "from-[#ffe3f1] to-card text-chart-pink dark:from-[#4a2150]",
    blue: "from-[#e1ecff] to-card text-[#4f7fe8] dark:from-[#22305c]",
  };
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-sm", bg[tint])}>
        <Icon className="size-6" />
      </span>
      <div className="leading-tight">
        <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** The violet-to-pink highlight card: one person, one number. */
export function HeroCard({
  icon,
  name,
  subtitle,
  score,
  max,
  caption,
  delta,
}: {
  /** Show a group icon instead of initials (a team has no face). */
  icon?: boolean;
  name: string;
  subtitle: string;
  score: number | null;
  max: number;
  caption: string;
  /** Change since last month, in points of the same scale; undefined/null when there is nothing to compare. */
  delta?: number | null;
}) {
  return (
    <div className="relative flex min-h-72 flex-col justify-between overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#7d68f0] via-[#a67fe6] to-[#e48dc4] p-5 text-ink shadow-sm">
      <div className="absolute -right-10 -top-10 size-44 rounded-full bg-white/25 blur-2xl" aria-hidden />
      {icon ? (
        <span className="relative flex size-16 items-center justify-center rounded-full bg-white/60 text-ink ring-4 ring-white/70">
          <Users className="size-7" />
        </span>
      ) : (
        <Avatar name={name} className="size-16 bg-white/60 text-xl text-ink ring-white/70" />
      )}
      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0 text-white">
          <p className="truncate text-2xl font-semibold leading-tight">{name}</p>
          <p className="truncate text-sm text-white/85">{subtitle}</p>
        </div>
        <div className="shrink-0 rounded-3xl border border-white/70 bg-white/25 px-4 py-2.5 text-center text-white backdrop-blur">
          <p className="text-2xl font-semibold tabular-nums leading-tight">
            {score == null ? "-" : formatPoints(score)}
            <span className="text-sm font-normal text-white/80"> / {formatPoints(max)}</span>
          </p>
          <p className="text-xs text-white/85">{caption}</p>
          {delta != null && Math.abs(delta) >= 0.05 && (
            <p
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold"
              title="Compared with last month"
            >
              {delta > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta).toFixed(1)} vs last month
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Weekly bars, scaled to the scorecard's maximum. */
export function WeekBars({ weeks, max }: { weeks: { week: number; total: number | null }[]; max: number }) {
  const best = Math.max(...weeks.map((w) => w.total ?? 0), 0);
  return (
    <div className="flex h-44 items-end justify-between gap-3 px-1" role="img" aria-label="Weekly scores">
      {weeks.map((w) => {
        const pct = w.total == null || max <= 0 ? 0 : Math.max(6, (w.total / max) * 100);
        const isBest = w.total != null && w.total === best && best > 0;
        return (
          <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{w.total == null ? "" : formatPoints(w.total)}</span>
            <div className="flex w-full max-w-9 flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-full",
                  w.total == null ? "h-1.5 bg-muted" : isBest ? "bg-gradient-to-t from-chart-pink to-[#f9a8d4]" : "bg-gradient-to-t from-brand to-[#a99bff]"
                )}
                style={w.total == null ? undefined : { height: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">W{w.week}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The dark-indigo list card: who has been scored and who is still waiting. */
export function StatusList({
  title,
  done,
  total,
  items,
}: {
  title: string;
  done: number;
  total: number;
  items: { id: string; name: string; meta: string; scored: boolean }[];
}) {
  return (
    <div className="rounded-[1.6rem] bg-ink p-5 text-ink-foreground shadow-md">
      <div className="flex items-baseline justify-between">
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-3xl font-light tabular-nums">
          {done}/{total}
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <Avatar name={i.name} className="size-9 bg-white/15 text-white ring-white/20" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="truncate text-xs text-ink-foreground/65">{i.meta}</p>
            </div>
            {i.scored ? (
              <span className="flex size-7 items-center justify-center rounded-full bg-brand text-white">
                <Check className="size-4" />
              </span>
            ) : (
              <Circle className="size-7 text-white/30" strokeWidth={1.5} />
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-ink-foreground/65">No one to show yet.</li>}
      </ul>
    </div>
  );
}

export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Colour follows the share earned, never the raw number — same rule as ScoreMeter. */
export function toneClass(percent: number): string {
  return percent >= 85 ? "bg-success" : percent >= 70 ? "bg-brand" : percent >= 50 ? "bg-warning" : "bg-destructive";
}

export interface BreakdownItem {
  key: string;
  label: string;
  hint?: string;
  people: number;
  scored: number;
  percent: number | null;
}

/** One level of the rollup: each group's total as a bar, with how many of its people are scored. */
function BreakdownList({ items }: { items: BreakdownItem[] }) {
  return (
    <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">
              {i.label}
              {i.hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{i.hint}</span>}
            </span>
            <span className="shrink-0 tabular-nums">
              {i.percent == null ? <span className="text-muted-foreground">not scored</span> : <strong>{formatPoints(i.percent)} / 100</strong>}
              <span className="ml-2 text-xs text-muted-foreground">
                {i.scored}/{i.people}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            {i.percent != null && <div className={cn("h-full rounded-full", toneClass(i.percent))} style={{ width: `${Math.min(100, i.percent)}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The rollup, level by level: organization, department, team. */
export function BreakdownPanel({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle: string;
  sections: { title: string; items: BreakdownItem[] }[];
}) {
  const shown = sections.filter((s) => s.items.length > 0);
  return (
    <Panel>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 space-y-6">
        {shown.map((s) => (
          <div key={s.title}>
            <p className="text-metadata mb-2.5">{s.title}</p>
            <BreakdownList items={s.items} />
          </div>
        ))}
        {shown.length === 0 && <p className="text-sm text-muted-foreground">Nothing scored yet this month.</p>}
      </div>
    </Panel>
  );
}

export interface RankItem {
  id: string;
  name: string;
  meta: string;
  percent: number;
  href: string;
}

/** A short ranked list of people — either who needs attention or who is leading. */
export function RankList({
  title,
  subtitle,
  items,
  empty,
  className,
}: {
  title: string;
  subtitle: string;
  items: RankItem[];
  empty: string;
  className?: string;
}) {
  return (
    <Panel className={className}>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {items.map((i, n) => (
            <li key={i.id}>
              <Link href={i.href} className="flex items-center gap-3 rounded-xl px-1 py-1 transition-ui hover:bg-accent">
                <span className="w-5 text-center text-sm font-semibold tabular-nums text-muted-foreground">{n + 1}</span>
                <Avatar name={i.name} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{i.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{i.meta}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
                  {formatPoints(i.percent)} <span className="font-normal text-muted-foreground">/ 100</span>
                  <span className={cn("size-2.5 rounded-full", toneClass(i.percent))} aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/** The weakest KRAs across everyone in view — the "why" behind a low total. */
export function KraPanel({
  items,
  className,
}: {
  items: { key: string; label: string; scorecard: string; people: number; percent: number; max: number }[];
  className?: string;
}) {
  return (
    <Panel className={className}>
      <p className="text-lg font-semibold">Weakest areas</p>
      <p className="text-sm text-muted-foreground">The KRAs pulling scores down across this view, where to act first.</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing scored yet this month.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((k) => (
            <li key={k.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {k.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {k.scorecard} · {k.people} {k.people === 1 ? "person" : "people"}
                  </span>
                </span>
                <strong className="shrink-0 tabular-nums">
                  {formatPoints(Math.round(((k.percent * k.max) / 100) * 10) / 10)} <span className="font-normal text-muted-foreground">/ {formatPoints(k.max)}</span>
                </strong>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className={cn("h-full rounded-full", toneClass(k.percent))} style={{ width: `${Math.min(100, k.percent)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
