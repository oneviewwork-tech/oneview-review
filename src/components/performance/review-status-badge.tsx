import { CheckCircle2, Clock, Pencil, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { REVIEW_STATE_LABEL, type ReviewState } from "@/domain/performance/workflow";

/**
 * Where a person's month has got to. Carried by an icon and a word, with
 * colour only reinforcing — amber and red can't be told apart by everyone, so
 * the icon is what separates "waiting" from "sent back".
 */
const STYLE: Record<ReviewState, { icon: LucideIcon; className: string }> = {
  DRAFT: { icon: Pencil, className: "bg-muted text-muted-foreground ring-border" },
  SUBMITTED: { icon: Clock, className: "bg-warning-subtle text-warning ring-warning/20" },
  NEEDS_REVISION: { icon: Undo2, className: "bg-destructive-subtle text-destructive ring-destructive/20" },
  CONFIRMED: { icon: CheckCircle2, className: "bg-success-subtle text-success ring-success/20" },
};

export function ReviewStatusBadge({ state, className }: { state: ReviewState; className?: string }) {
  const { icon: Icon, className: tone } = STYLE[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tone,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {REVIEW_STATE_LABEL[state]}
    </span>
  );
}
