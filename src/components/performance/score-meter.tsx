import { cn } from "@/lib/utils";

export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/** A score out of its maximum, with a bar. Tone follows the share earned, never the raw number. */
export function ScoreMeter({ score, max, className }: { score: number | null; max: number; className?: string }) {
  if (score == null) return <span className="text-muted-foreground">-</span>;
  const pct = max > 0 ? Math.min(100, Math.max(0, (score / max) * 100)) : 0;
  const tone = pct >= 85 ? "bg-success" : pct >= 70 ? "bg-brand" : pct >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatPoints(score)}
        <span className="font-normal text-muted-foreground"> / {formatPoints(max)}</span>
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
