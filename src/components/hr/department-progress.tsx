import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentProgress } from "@/services/review/dashboard";

/**
 * Departments ordered by how much is still outstanding, not alphabetically.
 *
 * The point of this list is to find the teams that still owe feedback, and
 * an A–Z ordering buries them among the ones that are already done. Finished
 * departments sink to the bottom and lose their meter, since a full bar
 * carries no information the tick doesn't.
 */
export function DepartmentProgressList({ departments }: { departments: DepartmentProgress[] }) {
  const ranked = [...departments].sort((a, b) => {
    const remainingA = a.totalEmployees - a.submitted;
    const remainingB = b.totalEmployees - b.submitted;
    if (remainingA !== remainingB) return remainingB - remainingA;
    return a.departmentName.localeCompare(b.departmentName);
  });

  if (ranked.length === 0) {
    return <p className="text-sm text-muted-foreground">No departments in this organization yet.</p>;
  }

  return (
    <ul className="space-y-3.5">
      {ranked.map((d) => {
        const pct = d.totalEmployees === 0 ? 0 : Math.round((d.submitted / d.totalEmployees) * 100);
        const remaining = Math.max(d.totalEmployees - d.submitted, 0);
        const complete = d.totalEmployees > 0 && remaining === 0;

        return (
          <li key={d.departmentId}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                <span className="truncate">{d.departmentName}</span>
                {complete && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-label="complete" />}
              </span>
              <span className={cn("shrink-0 tabular-nums", complete ? "text-success" : "text-muted-foreground")}>
                {complete ? (
                  "All in"
                ) : (
                  <>
                    <span className="font-medium text-foreground">{remaining}</span> left
                    <span className="text-metadata"> · {d.submitted}/{d.totalEmployees}</span>
                  </>
                )}
              </span>
            </div>
            {!complete && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                  // A started-but-tiny bar still needs to be visible as a
                  // sliver, or "1 of 29" looks identical to zero.
                  style={{ width: `${pct > 0 ? Math.max(pct, 3) : 0}%` }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
