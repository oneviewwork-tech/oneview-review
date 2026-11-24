"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronUp, Lock, Undo2 } from "lucide-react";
import { ReviewStatusBadge } from "@/components/performance/review-status-badge";
import { SubmitMonthButton } from "@/components/performance/workflow-actions";
import { REVIEW_STATE_LABEL, canEditScores, canSubmit, type ReviewState } from "@/domain/performance/workflow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ScoreMeter, formatPoints } from "@/components/performance/score-meter";
import { saveWeekScores } from "@/actions/performance.actions";
import { scoreWeek, type KpiDef } from "@/domain/performance/engine";
import { cn } from "@/lib/utils";
import { CriticalKpiForm, type CriticalKpi } from "@/components/performance/critical-kpi-form";

export interface ScoreFormKpi {
  id: string;
  name: string;
  description: string | null;
  maxPoints: number;
  mode: "RATING" | "TARGET";
  target: number | null;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | null;
  value: number | null;
  remark: string | null;
}
export interface ScoreFormKra {
  id: string;
  name: string;
  kpis: ScoreFormKpi[];
}

export function ScoreForm({
  people,
  employeeId,
  employeeName,
  templateName,
  period,
  periodOptions,
  week,
  monthWeeks,
  weekOptions,
  weekLock,
  criticalKpis,
  monthBase,
  maxTotal,
  kras,
  hasVersion,
  reviewState,
  revisionNote,
  reviewerName,
  weeksScored,
  monthLabel,
}: {
  /** Where this month's approval has got to. */
  reviewState: ReviewState;
  /** Why the reviewer sent it back, while it is NEEDS_REVISION. */
  revisionNote: string | null;
  /** Who will review it; null when it goes straight to HR. */
  reviewerName: string | null;
  weeksScored: number;
  monthLabel: string;
  /** Everyone this user scores, with how far each one's month has got. */
  people: { id: string; name: string; hint: string; weeksScored: number; state: ReviewState }[];
  /** Weeks in the month, for "2 / 4" on each person. */
  monthWeeks: number;
  employeeId: string;
  employeeName: string;
  templateName: string;
  period: string;
  periodOptions: { value: string; label: string }[];
  week: number;
  /** Every week of the month, with its dates and whether it is scored or still shut. */
  weekOptions: { value: string; label: string; hint?: string }[];
  /** Why the selected week can't be scored yet (weeks go in order), or null. */
  weekLock: string | null;
  /** This month's critical KPIs (deductions), with anything already entered. */
  criticalKpis: CriticalKpi[];
  /** Month average before deductions; null while nothing is scored. */
  monthBase: number | null;
  maxTotal: number;
  kras: ScoreFormKra[];
  hasVersion: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveWeekScores, undefined);

  const go = (next: { employee?: string; period?: string; week?: number }) => {
    const qs = new URLSearchParams({
      employee: next.employee ?? employeeId,
      period: next.period ?? period,
      ...(next.week ? { week: String(next.week) } : {}),
    });
    router.push(`/performance/score?${qs.toString()}`);
  };

  const kpis: KpiDef[] = useMemo(
    () =>
      kras.flatMap((kra) =>
        kra.kpis.map((k) => ({
          id: k.id,
          kraId: kra.id,
          maxPoints: k.maxPoints,
          mode: k.mode,
          target: k.target ?? undefined,
          direction: k.direction ?? undefined,
        }))
      ),
    [kras]
  );

  // Re-keyed per person/month/week by the parent form's `key`, so the
  // inputs always start from what is saved for exactly that combination.
  // Small teams get a strip of people with their progress; big lists (an
  // Admin acting for everyone) keep the searchable dropdown.
  const strip = people.length > 1 && people.length <= 15;

  return (
    <>
    {strip && (
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
        {people.map((p) => {
          const active = p.id === employeeId;
          const initials = p.name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
          const tone =
            p.state === "CONFIRMED" ? "bg-success" : p.state === "SUBMITTED" ? "bg-brand" : p.state === "NEEDS_REVISION" ? "bg-destructive" : p.weeksScored >= monthWeeks ? "bg-success" : "bg-warning";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => go({ employee: p.id, week: undefined })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-left shadow-sm transition-ui",
                active ? "bg-ink text-ink-foreground" : "bg-card hover:bg-accent"
              )}
            >
              <span className={cn("flex size-8 items-center justify-center rounded-full text-xs font-bold", active ? "bg-white/15" : "bg-muted")}>{initials}</span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className={cn("flex items-center gap-1.5 text-xs", active ? "opacity-75" : "text-muted-foreground")}>
                  <span className={cn("size-1.5 rounded-full", tone)} />
                  {p.state === "DRAFT" ? `${p.weeksScored} / ${monthWeeks} weeks` : REVIEW_STATE_LABEL[p.state]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    )}
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
      <Card className="p-5">
        <div className={cn("grid gap-4", !strip && "sm:grid-cols-2")}>
          {!strip && (
            <div className="space-y-1.5">
              <Label>Person</Label>
              <Dropdown
                value={employeeId}
                onChange={(v) => go({ employee: v, week: undefined })}
                options={people.map((p) => ({ value: p.id, label: p.name, hint: p.hint }))}
              />
            </div>
          )}
          <div className={cn("space-y-1.5", strip && "sm:max-w-xs")}>
            <Label>Month</Label>
            <Dropdown value={period} onChange={(v) => go({ period: v })} options={periodOptions} />
          </div>
        </div>

        {/* Weeks as buttons: scored ones ticked, the next one open, later ones locked. */}
        <div className="mt-4">
          <Label>Week</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Week">
            {weekOptions.map((o) => {
              const n = Number(o.value);
              const active = n === week;
              const locked = o.hint === "locked";
              const done = o.hint === "scored";
              const [title, range] = o.label.split(" · ");
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={locked && !active}
                  onClick={() => go({ week: n })}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-ui",
                    active ? "border-brand bg-brand-subtle" : "border-border bg-card hover:bg-accent",
                    locked && !active && "cursor-not-allowed opacity-50 hover:bg-card"
                  )}
                >
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-semibold", active && "text-brand")}>{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{range}</span>
                  </span>
                  {done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : locked ? (
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="size-2 shrink-0 rounded-full bg-warning" title="To score" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {!hasVersion ? (
          <EmptyState
            className="mt-5"
            title="No scorecard in force for this month"
            description={`${templateName} has no version covering ${period}. HR can add one under Scorecards.`}
          />
        ) : !canEditScores(reviewState) ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-muted p-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-semibold">
                {reviewState === "CONFIRMED" ? `${monthLabel} is confirmed and locked.` : `${monthLabel} is with ${reviewerName ?? "the reviewer"}.`}
              </p>
              <p className="mt-1 text-muted-foreground">
                {reviewState === "CONFIRMED"
                  ? "It has been approved and sent to HR, so it can no longer be changed."
                  : "Scores are locked while it is being reviewed. If they send it back, you'll be able to edit and resubmit."}
              </p>
              <Link href={`/performance/people/${employeeId}?period=${period}`} className="mt-2 inline-block text-brand hover:underline">
                View {employeeName}&apos;s scorecard
              </Link>
            </div>
          </div>
        ) : (
          <>
            {reviewState === "NEEDS_REVISION" && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-destructive-subtle p-4 text-destructive">
                <Undo2 className="mt-0.5 size-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">{reviewerName ?? "The reviewer"} sent this back for changes</p>
                  {revisionNote && <p className="mt-1">{revisionNote}</p>}
                  <p className="mt-1 text-destructive/80">Edit the scores, then submit again.</p>
                </div>
              </div>
            )}
          {weekLock ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-muted p-4">
              <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-semibold">Week {week} is locked</p>
                <p className="mt-1 text-muted-foreground">{weekLock} Weeks are scored in order.</p>
              </div>
            </div>
          ) : (
          <WeekFields
            key={`${employeeId}-${period}-${week}`}
            formAction={formAction}
            isPending={isPending}
            employeeId={employeeId}
            employeeName={employeeName}
            period={period}
            week={week}
            kras={kras}
            kpis={kpis}
            state={state}
            nextWeek={week < monthWeeks ? week + 1 : null}
            onNext={(n) => go({ week: n })}
          />
          )}
          </>
        )}
      </Card>
      {hasVersion && (
        <CriticalKpiForm
          key={`${employeeId}-${period}`}
          employeeId={employeeId}
          period={period}
          monthLabel={monthLabel}
          risks={criticalKpis}
          maxTotal={maxTotal}
          base={monthBase}
          editable={canEditScores(reviewState)}
        />
      )}
      </div>

      <div className="space-y-5">
        <Card className="p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-metadata">{monthLabel}</p>
            <ReviewStatusBadge state={reviewState} />
          </div>
          <p className="mt-2 text-muted-foreground">
            {canEditScores(reviewState)
              ? weeksScored > 0
                ? `${weeksScored} week${weeksScored === 1 ? "" : "s"} scored. When you're done, submit the month, it goes to ${reviewerName ?? "HR"}.`
                : "Nothing scored yet. Enter at least one week to submit the month."
              : reviewState === "CONFIRMED"
                ? "Confirmed and with HR."
                : `Waiting for ${reviewerName ?? "the reviewer"} to confirm or send it back.`}
          </p>
          {canSubmit(reviewState, weeksScored) && (
            <SubmitMonthButton
              className="mt-3 w-full"
              employeeId={employeeId}
              period={period}
              personName={employeeName}
              monthLabel={monthLabel}
              reviewerName={reviewerName}
            />
          )}
        </Card>

      <Card className="p-4 text-sm">
        <p className="text-metadata">Scoring</p>
        <p className="mt-2 text-muted-foreground">
          Award points from 0 up to each KPI&apos;s maximum. A month is the average of its scored weeks, so a week you
          don&apos;t score is skipped, while a week you score 0 counts.
        </p>
        <Link href={`/performance/people/${employeeId}?period=${period}`} className="mt-3 inline-block text-brand hover:underline">
          View {employeeName}&apos;s scorecard
        </Link>
      </Card>
      </div>
    </div>
    </>
  );
}

function WeekFields({
  formAction,
  isPending,
  employeeId,
  employeeName,
  period,
  week,
  kras,
  kpis,
  state,
  nextWeek,
  onNext,
}: {
  formAction: (formData: FormData) => void;
  isPending: boolean;
  employeeId: string;
  employeeName: string;
  period: string;
  week: number;
  kras: ScoreFormKra[];
  kpis: KpiDef[];
  state: Awaited<ReturnType<typeof saveWeekScores>> | undefined;
  /** The week after this one, offered once this one is saved. */
  nextWeek: number | null;
  onNext: (week: number) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(kras.flatMap((k) => k.kpis).map((p) => [p.id, p.value == null ? "" : String(p.value)]))
  );

  const live = useMemo(() => {
    const raw: Record<string, number> = {};
    for (const [id, v] of Object.entries(values)) {
      const n = Number(v);
      if (v.trim() !== "" && Number.isFinite(n)) raw[id] = n;
    }
    try {
      return scoreWeek(kpis, raw);
    } catch {
      return null;
    }
  }, [values, kpis]);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const orderedIds = kras.flatMap((k) => k.kpis.map((p) => p.id));
  const isLastWeek = nextWeek === null;
  // Whether this week, as currently shown, has every KPI filled - the next
  // week (or, on the last week, the month) only unlocks once this is true.
  const allFilled = orderedIds.every((id) => (values[id] ?? "").trim() !== "");

  // The field's own up/down spinner (the small arrows a number input draws
  // inside itself) steps the value by click, not just by keyboard - the
  // original complaint was clicking those arrows, which easy to brush
  // against while moving between fields and hard to notice happened.
  // Hidden via CSS below and replaced with custom up/down arrows that jump
  // to the previous/next KPI field instead, like a big scale across the
  // whole scorecard rather than within one field. PageUp/PageDown and Enter
  // do the same jump from the keyboard, so nothing changes the value by
  // accident from any of the ways someone might reach for "next field".
  const jumpField = (from: HTMLInputElement, delta: 1 | -1) => {
    const idx = orderedIds.indexOf(from.name.replace(/^value_/, ""));
    const next = orderedIds[idx + delta];
    if (!next) return;
    const target = from.form?.elements.namedItem(`value_${next}`);
    if (target instanceof HTMLInputElement) {
      target.focus();
      target.select();
    }
  };

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="week" value={week} />

      {kras.map((kra) => (
        <section key={kra.id}>
          <h3 className="mb-2 text-sm font-semibold">{kra.name}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {kra.kpis.map((k) => {
              const err = fieldErrors?.[`value_${k.id}`]?.[0];
              return (
                <li key={k.id} className="grid items-start gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1.2fr)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {k.mode === "RATING"
                        ? `Max ${formatPoints(k.maxPoints)} pts`
                        : `${formatPoints(k.maxPoints)} pts · target ${k.direction === "LOWER_IS_BETTER" ? "≤" : "≥"} ${k.target}`}
                      {k.description ? ` · ${k.description}` : ""}
                    </p>
                  </div>
                  <div>
                  <div className="relative">
                    <Input
                      name={`value_${k.id}`}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0}
                      max={k.mode === "RATING" ? k.maxPoints : undefined}
                      placeholder={k.mode === "RATING" ? `0–${formatPoints(k.maxPoints)}` : "actual"}
                      value={values[k.id] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [k.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        // Enter would otherwise submit the whole week as-is,
                        // even with other fields still blank - jump to the
                        // next field instead, same as PageDown.
                        if (e.key === "PageDown" || e.key === "Enter") { e.preventDefault(); jumpField(e.currentTarget, 1); }
                        else if (e.key === "PageUp") { e.preventDefault(); jumpField(e.currentTarget, -1); }
                      }}
                      aria-label={`${k.name} ${k.mode === "RATING" ? "points" : "measured value"}`}
                      aria-invalid={!!err}
                      className={cn(
                        "pr-7 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                        err && "border-destructive"
                      )}
                    />
                    {/* Replaces the native spinner (which changed the value on click, the
                        original complaint) with arrows that move between fields instead. */}
                    <div className="absolute inset-y-0 right-1 flex flex-col justify-center">
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Go to the previous field`}
                        onClick={(e) => jumpField(e.currentTarget.parentElement!.parentElement!.querySelector("input")!, -1)}
                        className="flex h-4 w-5 items-center justify-center rounded-t text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <ChevronUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Go to the next field`}
                        onClick={(e) => jumpField(e.currentTarget.parentElement!.parentElement!.querySelector("input")!, 1)}
                        className="flex h-4 w-5 items-center justify-center rounded-b text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <ChevronDown className="size-3" />
                      </button>
                    </div>
                  </div>
                    {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                  </div>
                  <Input name={`remark_${k.id}`} defaultValue={k.remark ?? ""} placeholder="Remark (optional)" maxLength={500} aria-label={`${k.name} remark`} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {state?.success && isLastWeek && allFilled && (
        <div className="animate-scale-in flex items-center gap-3 rounded-2xl bg-success-subtle p-4 text-success">
          <CheckCircle2 className="size-8 shrink-0 animate-scale-in" />
          <div className="animate-fade-up">
            <p className="font-semibold">Score submitted successfully 🎉</p>
            <p className="text-sm text-success/80">Every week this month is scored. Submit the month when you&apos;re ready.</p>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-metadata">Week {week} total</span>
          <ScoreMeter score={live ? live.total : null} max={live?.maxTotal ?? 0} />
        </div>
        <div className="flex items-center gap-3">
          {state?.success && (
            <span className="flex items-center gap-1.5 text-sm text-success" role="status">
              <CheckCircle2 className="size-4" />
              {allFilled ? state.message : `${state.message} Fill every field to unlock ${nextWeek ? `Week ${nextWeek}` : "the next week"}.`}
            </span>
          )}
          {state?.success && nextWeek && allFilled && (
            <Button type="button" variant="outline" onClick={() => onNext(nextWeek)}>
              Next: Week {nextWeek} →
            </Button>
          )}
          {state && !state.success && (
            <span className="text-sm text-destructive" role="alert">
              {state.message}
            </span>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : `Save week ${week}`}
          </Button>
        </div>
      </div>
      <span className="sr-only">Scoring {employeeName}</span>
    </form>
  );
}
