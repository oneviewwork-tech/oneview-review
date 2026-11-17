import { CheckCircle2, CircleDot, ClipboardList, Hourglass, ShieldAlert, UserRound } from "lucide-react";
import { PeriodFilter } from "@/components/hr/period-filter";
import type { Grade } from "@/domain/performance/grading";
import type { ReviewState } from "@/domain/performance/workflow";
import { cn } from "@/lib/utils";

export interface MyKra {
  id: string;
  name: string;
  max: number;
  part: "PERFORMANCE" | "POTENTIAL";
  kpis: { id: string; name: string; max: number; description: string | null; /** Month average, manager view only. */ points?: number | null }[];
  /** Month average for the KRA, manager view only. */
  points?: number | null;
}

/** The actual numbers, shown to scorers, reviewers, HR and Admin — never to the person themselves. */
export interface ExactScores {
  /** Month score after deductions (or the confirmed, frozen one); null before anything is scored. */
  score: number | null;
  max: number;
  performance: number | null;
  potential: number | null;
  /** Critical KPI deductions this month. */
  deduction: number;
  /** riskName -> points deducted. */
  penalties: Record<string, number>;
  weeksScored: number;
}

export interface MyBand {
  grade: Grade;
  label: string;
  range: string;
}

const GRADE_BG: Record<Grade, string> = { A: "bg-success", B: "bg-brand", C: "bg-destructive" };
const GRADE_CHIP: Record<Grade, string> = {
  A: "bg-success-subtle text-success",
  B: "bg-brand-subtle text-brand",
  C: "bg-destructive-subtle text-destructive",
};

/** A rounded bento tile. */
function Tile({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[1.75rem] bg-card p-6 shadow-sm", className)} {...props} />;
}

/**
 * What a person sees of their own scorecard, laid out as a bento board:
 * a greeting and headline figures, then tiles — who they are, their result
 * (a band, never the exact score), the Performance / Potential split, what
 * to avoid, their role, and what they're measured on.
 */
export function MyScorecard({
  name,
  designation,
  department,
  scorerName,
  reviewerName,
  monthLabel,
  periodOptions,
  state,
  band,
  bands,
  confirmedOn,
  kras,
  performanceMax,
  potentialMax,
  risks,
  roleDefinition,
  responsibilities,
  templateName,
  history,
  photoUrl,
  exact,
  actions,
  children,
}: {
  name: string;
  designation: string | null;
  department: string;
  scorerName: string;
  reviewerName: string | null;
  monthLabel: string;
  periodOptions: { value: string; label: string }[];
  state: ReviewState;
  /** Set only once the month is confirmed. */
  band: MyBand | null;
  /** The three bands, best first. */
  bands: MyBand[];
  confirmedOn: string | null;
  kras: MyKra[];
  performanceMax: number;
  potentialMax: number;
  risks: { group: string; items: string[] }[];
  roleDefinition: string | null;
  responsibilities: string[];
  templateName: string;
  history: { label: string; band: MyBand }[];
  /** Their ONEVIEW People profile photo, if they have one. */
  photoUrl?: string;
  /** Someone else viewing: show the real numbers on every card. */
  exact?: ExactScores;
  /** Buttons for the header (Score, Submit…), manager view. */
  actions?: React.ReactNode;
  /** Detail below the board (week by week, approval, feedback). */
  children?: React.ReactNode;
}) {
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  const you = !exact;
  const firstName = name.split(/\s+/)[0] ?? name;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const kpiCount = kras.reduce((n, k) => n + k.kpis.length, 0);
  const total = performanceMax + potentialMax;
  const stage = state === "CONFIRMED" ? "Confirmed" : state === "SUBMITTED" ? "In review" : "Being scored";

  return (
    <div className="animate-fade-up">
      {/* ── Greeting + month ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{you ? `Welcome in, ${firstName}` : name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter periods={periodOptions} />
          {actions}
        </div>
      </div>

      {/* ── Headline figures: labelled pills, then big numbers ─────── */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <Figure label="Month">
            <Pill className="bg-ink text-ink-foreground">{monthLabel}</Pill>
          </Figure>
          <Figure label="Status">
            <Pill className={state === "CONFIRMED" ? "bg-success text-white" : "bg-brand text-brand-foreground"}>{stage}</Pill>
          </Figure>
          <Figure label="Scored by">
            <Pill className="border-2 border-ink/70">{scorerName}</Pill>
          </Figure>
          {reviewerName && (
            <Figure label="Reviewed by">
              <Pill className="border-2 border-dashed border-ink/40 text-muted-foreground">{reviewerName}</Pill>
            </Figure>
          )}
        </div>
        <div className="flex gap-10">
          <BigNumber value={kras.length} label="KRAs" />
          <BigNumber value={kpiCount} label="KPIs" />
          <BigNumber value={total} label="Points / week" />
        </div>
      </div>

      {/* ── Bento ──────────────────────────────────────────────────── */}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* Who */}
        <Tile className="relative flex min-h-72 flex-col justify-end overflow-hidden bg-ink p-6 text-white">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own authed route, already a sized thumbnail
            <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center pb-16 text-7xl font-bold tracking-tight text-white/15">
              {initials}
            </span>
          )}
          {/* Keeps the name readable over any photo. */}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{templateName}</p>
            <p className="mt-1 text-2xl font-semibold leading-tight">{name}</p>
            <p className="mt-1 text-sm opacity-85">{designation ?? "-"}</p>
            <p className="text-sm opacity-65">{department}</p>
          </div>
        </Tile>

        {/* Result */}
        <Tile className="flex min-h-64 flex-col">
          <p className="text-2xl font-semibold">Result</p>
          {exact ? (
            exact.score == null ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">Nothing scored for {monthLabel} yet.</p>
                <Steps state={state} scorerName={scorerName} reviewerName={reviewerName} />
              </>
            ) : (
              <>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tabular-nums">{fmt(exact.score)}</span>
                  <span className="text-muted-foreground">/ {fmt(exact.max)}</span>
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {band && <span className={cn("rounded-full px-2.5 py-0.5 font-semibold", GRADE_CHIP[band.grade])}>{band.label}</span>}
                  <span>
                    {exact.weeksScored} week{exact.weeksScored === 1 ? "" : "s"} averaged
                    {exact.deduction > 0 ? ` · −${fmt(exact.deduction)} critical` : ""}
                  </span>
                </p>
                {band && <BandBars bands={bands} active={band.grade} />}
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {state === "CONFIRMED" ? <CheckCircle2 className="size-3.5 text-success" /> : <Hourglass className="size-3.5" />}
                  {state === "CONFIRMED"
                    ? `Confirmed${reviewerName ? ` by ${reviewerName}` : ""}${confirmedOn ? ` · ${confirmedOn}` : ""}`
                    : `${stage}, not final yet`}
                </p>
              </>
            )
          ) : band ? (
            <>
              <p className="mt-2">
                <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", GRADE_CHIP[band.grade])}>{band.label}</span>
              </p>
              <BandBars bands={bands} active={band.grade} />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-success" />
                Confirmed{reviewerName ? ` by ${reviewerName}` : ""}
                {confirmedOn ? ` · ${confirmedOn}` : ""}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Shown as a band once {monthLabel} is confirmed.</p>
              <Steps state={state} scorerName={scorerName} reviewerName={reviewerName} />
            </>
          )}
        </Tile>

        {/* Performance / Potential */}
        <Tile className="flex min-h-64 flex-col">
          <p className="text-2xl font-semibold">{you ? "Your split" : "Split"}</p>
          <div className="flex flex-1 items-center justify-center py-3">
            {exact && exact.performance != null && exact.potential != null ? (
              <ScoreRings perf={exact.performance} perfMax={performanceMax} pot={exact.potential} potMax={potentialMax} />
            ) : (
              <SplitRing performance={performanceMax} potential={potentialMax} />
            )}
          </div>
          {/* One row each, value right-aligned, so nothing wraps in a narrow tile. */}
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-brand" /> Performance
              </dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums">
                {exact && exact.performance != null ? `${fmt(exact.performance)} / ${performanceMax}` : performanceMax}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-chart-pink" /> Potential
              </dt>
              <dd className="whitespace-nowrap font-semibold tabular-nums">
                {exact && exact.potential != null ? `${fmt(exact.potential)} / ${potentialMax}` : potentialMax}
              </dd>
            </div>
          </dl>
        </Tile>

        {/* Avoid — tall dark tile */}
        <Tile className="flex flex-col bg-ink text-ink-foreground lg:row-span-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-semibold">{you ? "Critical: avoid these" : "Critical KPIs"}</p>
            <span className="text-3xl font-semibold tabular-nums">
              {exact ? (exact.deduction > 0 ? `−${fmt(exact.deduction)}` : "0") : risks.reduce((n, g) => n + g.items.length, 0)}
            </span>
          </div>
          <p className="mt-1 text-xs opacity-60">
            {exact
              ? exact.deduction > 0
                ? "Points deducted from this month's score."
                : "No deductions this month."
              : "Any of these brings your month's result down."}
          </p>
          {risks.length === 0 ? (
            <p className="mt-6 text-sm opacity-70">No critical KPIs on your scorecard.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {risks.map((g) => (
                <li key={g.group} className="flex gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <ShieldAlert className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{g.group}</span>
                    <span className="block text-xs leading-snug opacity-60">
                      {g.items.map((i, n) => (
                        <span key={i}>
                          {n > 0 && " · "}
                          {i}
                          {exact?.penalties[i] ? <strong className="text-chart-pink"> −{fmt(exact.penalties[i])}</strong> : null}
                        </span>
                      ))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <div className="mt-auto pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Past months</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {history.map((h) => (
                  <span key={h.label} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", GRADE_CHIP[h.band.grade])}>
                    {h.label} · {h.band.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Tile>

        {/* Role */}
        <Tile>
          <p className="flex items-center gap-2 text-lg font-semibold">
            <UserRound className="size-4 text-brand" /> {you ? "My role" : "Role"}
          </p>
          {roleDefinition ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{roleDefinition}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No role definition added yet.</p>
          )}
          {responsibilities.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-border pt-4">
              {responsibilities.map((r) => (
                <li key={r} className="flex gap-2 text-sm leading-snug">
                  <CircleDot className="mt-0.5 size-3.5 shrink-0 text-brand" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        {/* Measured on — wide */}
        <Tile className="md:col-span-2 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold">{you ? "What you're measured on" : `${monthLabel}: month average per KPI`}</p>
            <div className="flex gap-2 text-xs font-semibold">
              <span className="rounded-full bg-brand-subtle px-3 py-1 text-brand">Performance · {performanceMax}</span>
              <span className="rounded-full bg-chart-pink/15 px-3 py-1 text-chart-pink">Potential · {potentialMax}</span>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {kras.map((kra) => (
              <div key={kra.id} className="rounded-2xl bg-muted/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 font-semibold leading-snug">
                    <span className={cn("size-2 shrink-0 rounded-full", kra.part === "PERFORMANCE" ? "bg-brand" : "bg-chart-pink")} />
                    {kra.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">
                    {exact && kra.points != null ? `${fmt(kra.points)} / ${kra.max}` : kra.max}
                  </span>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {kra.kpis.map((k) => (
                    <li key={k.id} className="flex items-start justify-between gap-3 text-sm">
                      <span className="leading-snug">{k.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {exact && k.points != null ? (
                          <>
                            <strong className="text-foreground">{fmt(k.points)}</strong> / {k.max}
                          </>
                        ) : (
                          k.max
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Tile>
      </div>

      {children}
    </div>
  );
}

/** Two concentric rings: Performance (outer) and Potential (inner), each filled to its score. */
function ScoreRings({ perf, perfMax, pot, potMax }: { perf: number; perfMax: number; pot: number; potMax: number }) {
  const ring = (r: number, value: number, max: number, cls: string) => {
    const c = 2 * Math.PI * r;
    const fill = max > 0 ? Math.min(1, value / max) * c : 0;
    return (
      <>
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="12" className={cls} strokeDasharray={`${fill} ${c}`} transform="rotate(-90 70 70)" strokeLinecap="round" />
      </>
    );
  };
  return (
    <svg viewBox="0 0 140 140" className="size-36" role="img" aria-label={`Performance ${perf} of ${perfMax}, Potential ${pot} of ${potMax}`}>
      {ring(58, perf, perfMax, "stroke-brand")}
      {ring(40, pot, potMax, "stroke-chart-pink")}
      <text x="70" y="75" textAnchor="middle" className="fill-foreground text-[15px] font-semibold">
        {Math.round((perf + pot) * 10) / 10}
      </text>
    </svg>
  );
}

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold", className)}>{children}</span>;
}

function Figure({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function BigNumber({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-right">
      <p className="text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Three bars, low to high, the person's own band lit. */
function BandBars({ bands, active }: { bands: MyBand[]; active: Grade }) {
  const ordered = [...bands].reverse(); // C, B, A
  const heights = ["h-10", "h-16", "h-24"];
  return (
    <div className="mt-auto grid grid-cols-3 items-end gap-3 pt-4">
      {ordered.map((b, i) => {
        const on = b.grade === active;
        return (
          <div key={b.grade} className="flex flex-col items-center gap-2">
            <span className={cn("w-3 rounded-full", heights[i], on ? GRADE_BG[b.grade] : "bg-ink/15")} />
            <span className={cn("size-1.5 rounded-full", on ? GRADE_BG[b.grade] : "bg-ink/30")} />
            <span className={cn("text-center text-[11px] leading-tight", on ? "font-semibold" : "text-muted-foreground")}>{b.range}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A ring split Performance / Potential. */
function SplitRing({ performance, potential }: { performance: number; potential: number }) {
  const total = performance + potential || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const perf = (performance / total) * c;
  return (
    <svg viewBox="0 0 140 140" className="size-36" role="img" aria-label={`Performance ${performance}, Potential ${potential}`}>
      <circle cx="70" cy="70" r={r} fill="none" strokeWidth="16" className="stroke-chart-pink" strokeDasharray={`${c - perf - 6} ${c}`} strokeDashoffset={-perf - 3} transform="rotate(-90 70 70)" strokeLinecap="round" />
      <circle cx="70" cy="70" r={r} fill="none" strokeWidth="16" className="stroke-brand" strokeDasharray={`${perf - 6} ${c}`} strokeDashoffset={-3} transform="rotate(-90 70 70)" strokeLinecap="round" />
      <text x="70" y="76" textAnchor="middle" className="fill-foreground text-[20px] font-semibold">
        {performance}/{potential}
      </text>
    </svg>
  );
}

/** Where an unconfirmed month has got to, without any numbers. */
function Steps({ state, scorerName, reviewerName }: { state: ReviewState; scorerName: string; reviewerName: string | null }) {
  const at = state === "SUBMITTED" ? 1 : state === "CONFIRMED" ? 2 : 0;
  const steps = [
    { icon: ClipboardList, title: "Being scored", detail: `by ${scorerName}` },
    { icon: Hourglass, title: "In review", detail: reviewerName ? `with ${reviewerName}` : "with the reviewer" },
    { icon: CheckCircle2, title: "Confirmed", detail: "your band appears" },
  ];
  return (
    <ol className="mt-auto space-y-2 pt-4">
      {steps.map((s, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={s.title} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                current ? "bg-brand text-brand-foreground" : done ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground"
              )}
            >
              <s.icon className="size-4" />
            </span>
            <span className={cn("min-w-0", !current && !done && "opacity-60")}>
              <span className="block text-sm font-semibold leading-tight">{s.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{s.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
