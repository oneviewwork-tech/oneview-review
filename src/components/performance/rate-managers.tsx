"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rateManagers } from "@/actions/rating.actions";
import { cn } from "@/lib/utils";

export const STAR_LABEL = ["", "Very poor", "Poor", "Good", "Very good", "Excellent"] as const;

export interface RateTarget {
  ratedAs: "SCORER" | "REVIEWER";
  /** "Your manager" / "Your head" */
  role: string;
  name: string;
  /** Already rated this month: their stars. */
  given: number | null;
}

/**
 * Once a month is confirmed, the employee rates their manager and head:
 * 1–5 stars and an optional note. Private — only HR and Admin see ratings;
 * the people rated never do. Each can be rated once per month.
 */
export function RateManagers({ period, monthLabel, targets }: { period: string; monthLabel: string; targets: RateTarget[] }) {
  const open = targets.filter((t) => t.given == null);
  const [stars, setStars] = useState<Record<string, number>>({});
  const [hover, setHover] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await rateManagers({
        period,
        ratings: open.filter((t) => stars[t.ratedAs]).map((t) => ({ ratedAs: t.ratedAs, stars: stars[t.ratedAs], message: notes[t.ratedAs] || undefined })),
      });
      if (!r.success) return setError(r.message);
      router.refresh();
    });

  return (
    <div className="mt-6 rounded-[1.75rem] bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Rate your manager and head</p>
          <p className="text-sm text-muted-foreground">How did they support you in {monthLabel}? Once per month.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Private: only HR sees this, never the person you rate
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {targets.map((t) => {
          // Hover previews; 0 (mouse left) falls back to the chosen stars.
          const value = t.given ?? (hover[t.ratedAs] || stars[t.ratedAs] || 0);
          const done = t.given != null;
          return (
            <div key={t.ratedAs} className="rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.role}</p>
              <p className="font-semibold">{t.name}</p>
              <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label={`Rate ${t.name}`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars[t.ratedAs] === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}, ${STAR_LABEL[n]}`}
                    disabled={done}
                    onMouseEnter={() => setHover((h) => ({ ...h, [t.ratedAs]: n }))}
                    onMouseLeave={() => setHover((h) => ({ ...h, [t.ratedAs]: 0 }))}
                    onClick={() => setStars((s) => ({ ...s, [t.ratedAs]: n }))}
                    className={cn("rounded-md p-0.5 transition-transform", !done && "hover:scale-110")}
                  >
                    <Star className={cn("size-7", n <= value ? "fill-warning text-warning" : "text-muted-foreground/40")} />
                  </button>
                ))}
                <span className={cn("ml-2 text-sm font-medium", value ? "text-foreground" : "text-muted-foreground")}>
                  {value ? STAR_LABEL[value] : "Tap to rate"}
                </span>
              </div>
              {done ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="size-4" /> Rated for {monthLabel}. Thank you.
                </p>
              ) : (
                <textarea
                  value={notes[t.ratedAs] ?? ""}
                  onChange={(e) => setNotes((m) => ({ ...m, [t.ratedAs]: e.target.value }))}
                  placeholder="Anything you'd like to add? (optional)"
                  maxLength={1000}
                  rows={2}
                  className="mt-3 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-brand sm:text-sm"
                />
              )}
            </div>
          );
        })}
      </div>

      {open.length > 0 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" loading={pending} disabled={!open.some((t) => stars[t.ratedAs])} onClick={submit}>
            Submit rating
          </Button>
        </div>
      )}
    </div>
  );
}
