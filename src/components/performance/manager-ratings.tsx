import { Lock, MessageSquareQuote, Star } from "lucide-react";
import { Panel } from "@/components/performance/dashboard-widgets";
import { cn } from "@/lib/utils";

const LABEL = ["", "Very poor", "Poor", "Good", "Very good", "Excellent"];

export interface RatedPerson {
  userId: string;
  name: string;
  /** "Manager", "Head", or both. */
  roles: string[];
  ratings: { stars: number; message: string | null; rater: string; month: string }[];
}

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= Math.round(value) ? "fill-warning text-warning" : "text-muted-foreground/30")} />
      ))}
    </span>
  );
}

/**
 * How a department's people rated their managers and heads — HR and Admin
 * only; the people rated never see this. Average, how the stars spread, and
 * the notes left with them.
 */
export function ManagerRatings({ people, windowLabel }: { people: RatedPerson[]; windowLabel: string }) {
  return (
    <Panel className="mt-6 p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 p-6 pb-4">
        <div>
          <p className="text-eyebrow">Upward feedback</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Manager ratings</h2>
          <p className="text-sm text-muted-foreground">How this department&apos;s people rated their manager and head, {windowLabel}.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> HR &amp; Admin only, never shown to the person rated
        </span>
      </div>

      {people.length === 0 ? (
        <p className="mx-6 mb-6 rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No ratings yet. Employees can rate once their month is confirmed.
        </p>
      ) : (
        <div className="grid gap-4 px-6 pb-6 md:grid-cols-2">
          {people.map((p) => {
            const avg = p.ratings.reduce((s, r) => s + r.stars, 0) / p.ratings.length;
            const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: p.ratings.filter((r) => r.stars === n).length }));
            const notes = p.ratings.filter((r) => r.message);
            return (
              <div key={p.userId} className="rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.roles.join(" · ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-semibold leading-none tabular-nums">{avg.toFixed(1)}</p>
                    <Stars value={avg} />
                    <p className="text-xs text-muted-foreground">
                      {p.ratings.length} rating{p.ratings.length === 1 ? "" : "s"} · {LABEL[Math.round(avg)]}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  {dist.map((d) => (
                    <div key={d.n} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0 text-muted-foreground">{LABEL[d.n]}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-warning" style={{ width: `${(d.count / p.ratings.length) * 100}%` }} />
                      </span>
                      <span className="w-5 shrink-0 text-right tabular-nums">{d.count}</span>
                    </div>
                  ))}
                </div>

                {notes.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-border pt-3">
                    {notes.slice(0, 4).map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block leading-snug">“{r.message}”</span>
                          <span className="text-xs text-muted-foreground">
                            {r.rater} · {r.month} · <Stars value={r.stars} size="size-3" />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
