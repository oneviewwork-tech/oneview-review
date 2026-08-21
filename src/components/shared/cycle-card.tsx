import Link from "next/link";
import { Send } from "lucide-react";
import { formatReviewPeriod } from "@/domain/review/period";
import type { SidebarCycle } from "@/services/review/sidebar";

/**
 * Where this month's review cycle has got to, pinned in the sidebar.
 *
 * This product has far fewer destinations than its sibling, so the nav
 * column would otherwise trail off into empty space. Unlike the badges —
 * which appear only when something is outstanding — this is always there,
 * and it answers the one question the whole product exists to serve:
 * how much feedback is in.
 *
 * Kept deliberately short. Every row added here is a row taken from the
 * navigation above it.
 */
export function CycleCard({ cycle }: { cycle: SidebarCycle }) {
  const pct = cycle.total === 0 ? 0 : Math.round((cycle.submitted / cycle.total) * 100);
  const complete = cycle.total > 0 && cycle.submitted >= cycle.total;

  return (
    <div className="rounded-xl border border-border bg-muted p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-xs font-semibold text-foreground">{formatReviewPeriod(cycle.period)}</p>
        <p className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{pct}%</p>
      </div>

      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            complete ? "bg-success" : "bg-brand"
          }`}
          // A started-but-tiny bar still needs to register as non-zero.
          style={{ width: `${pct > 0 ? Math.max(pct, 4) : 0}%` }}
        />
      </div>

      <p className="mt-1.5 truncate text-[11px] leading-tight text-muted-foreground">
        {cycle.submitted} of {cycle.total} collected
      </p>

      {cycle.readyToSend > 0 && (
        <Link
          href="/submissions"
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand px-2 py-1.5 text-[11px] font-semibold text-brand-foreground transition-ui hover:bg-brand-hover"
        >
          <Send className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{cycle.readyToSend} ready to send</span>
        </Link>
      )}
    </div>
  );
}
