"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { savePenalties } from "@/actions/performance.actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPoints } from "@/components/performance/score-meter";
import { cn } from "@/lib/utils";

export interface CriticalKpi {
  id: string;
  category: string;
  name: string;
  description: string | null;
  /** Most that can be deducted; null = up to the scorecard's max. */
  maxPenalty: number | null;
  points: number | null;
  remark: string | null;
}

/**
 * Critical KPI deductions for the month. Whatever is entered here comes off
 * the month's score: a month averaging 85 with 25 deducted ends at 60.
 */
export function CriticalKpiForm({
  employeeId,
  period,
  monthLabel,
  risks,
  maxTotal,
  base,
  editable,
}: {
  employeeId: string;
  period: string;
  monthLabel: string;
  risks: CriticalKpi[];
  maxTotal: number;
  /** The month's average before deductions; null while nothing is scored. */
  base: number | null;
  editable: boolean;
}) {
  const [state, formAction, isPending] = useActionState(savePenalties, undefined);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(risks.map((r) => [r.id, r.points != null ? String(r.points) : ""]))
  );
  if (risks.length === 0) return null;

  const deduction = Object.values(values).reduce((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);
  const groups = [...new Set(risks.map((r) => r.category))];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <p className="font-semibold">Critical KPIs · {monthLabel}</p>
            <p className="text-sm text-muted-foreground">Points entered here are deducted from the month&apos;s score. Leave blank if nothing happened.</p>
          </div>
        </div>
        <div className="rounded-xl bg-muted px-3 py-2 text-right text-sm tabular-nums">
          {base != null ? (
            <>
              <span className="text-muted-foreground">{formatPoints(base)}</span>
              {deduction > 0 && <span className="text-destructive"> − {formatPoints(deduction)}</span>}
              <span className="font-semibold"> = {formatPoints(Math.max(0, base - deduction))}</span>
              <span className="text-muted-foreground"> / {formatPoints(maxTotal)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{deduction > 0 ? `− ${formatPoints(deduction)} pts` : "No deductions"}</span>
          )}
        </div>
      </div>

      <form action={formAction} className="mt-5 space-y-5">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="period" value={period} />
        {groups.map((g) => (
          <section key={g}>
            <h3 className="mb-2 text-sm font-semibold">{g}</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {risks
                .filter((r) => r.category === g)
                .map((r) => {
                  const err = state && !state.success ? state.fieldErrors?.[`penalty_${r.id}`]?.[0] : undefined;
                  const cap = r.maxPenalty ?? maxTotal;
                  return (
                    <li key={r.id} className="grid items-start gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1.2fr)]">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Up to −{formatPoints(cap)} pts{r.description ? ` · ${r.description}` : ""}
                        </p>
                      </div>
                      <div>
                        <Input
                          name={`penalty_${r.id}`}
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min={0}
                          max={cap}
                          placeholder="0"
                          disabled={!editable}
                          value={values[r.id] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          aria-label={`${r.name} deduction`}
                          aria-invalid={!!err}
                          className={cn(err && "border-destructive")}
                        />
                        {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
                      </div>
                      <Input
                        name={`penaltyRemark_${r.id}`}
                        defaultValue={r.remark ?? ""}
                        placeholder="What happened (optional)"
                        maxLength={500}
                        disabled={!editable}
                        aria-label={`${r.name} remark`}
                      />
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
        {editable && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {state?.success && (
              <span className="flex items-center gap-1.5 text-sm text-success" role="status">
                <CheckCircle2 className="size-4" /> {state.message}
              </span>
            )}
            {state && !state.success && (
              <span className="text-sm text-destructive" role="alert">
                {state.message}
              </span>
            )}
            <Button type="submit" variant="outline" disabled={isPending}>
              {isPending ? "Saving…" : "Save deductions"}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
