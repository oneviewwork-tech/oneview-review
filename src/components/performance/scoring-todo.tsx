import Link from "next/link";
import { CheckCircle2, ListTodo } from "lucide-react";
import { Panel } from "@/components/performance/dashboard-widgets";
import { Avatar } from "@/components/shared/avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import type { TodoItem } from "@/services/notifications/in-app";
import { cn } from "@/lib/utils";

const weekList = (w: number[]) => (w.length === 1 ? `Week ${w[0]}` : `Weeks ${w.join(", ")}`);

/**
 * The scorer's own to-do: everyone they still owe a week's score this month,
 * with a button straight to the week to score next. Late ones first.
 */
export function ScoringTodo({ items }: { items: TodoItem[] }) {
  const late = items.filter((i) => i.late.length > 0).length;
  return (
    <Panel className="mt-6 p-0">
      <div className="flex items-start gap-3 p-5 pb-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            items.length === 0 ? "bg-success-subtle text-success" : late ? "bg-destructive-subtle text-destructive" : "bg-brand-subtle text-brand"
          )}
        >
          {items.length === 0 ? <CheckCircle2 className="size-4" /> : <ListTodo className="size-4" />}
        </span>
        <div>
          <p className="font-semibold">Your scoring to-do</p>
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Nothing pending: everyone you score is up to date."
              : `${items.length} ${items.length === 1 ? "person needs" : "people need"} a score${late ? `, ${late} late` : ""}. Weeks are scored in order.`}
          </p>
        </div>
      </div>
      {items.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((i) => (
            <li key={`${i.employeeId}-${i.period}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Avatar name={i.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground">
                  {i.monthLabel} · {weekList(i.weeks)} not scored
                </p>
              </div>
              {i.late.length > 0 && (
                <span className="rounded-full bg-destructive-subtle px-2.5 py-0.5 text-xs font-semibold text-destructive">
                  {i.late.length} late
                </span>
              )}
              <Link
                href={`/performance/score?employee=${i.employeeId}&period=${i.period}&week=${i.weeks[0]}`}
                className={buttonVariants({ size: "sm", className: "rounded-full" })}
              >
                Score week {i.weeks[0]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
