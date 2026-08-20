import { Clock, Undo2, CheckCircle2, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@prisma/client";

/**
 * Status is carried by an icon and a word, with colour only reinforcing.
 *
 * Amber and red cannot be separated far enough for deuteranopia at usable
 * lightness (measured: ΔE 3.2) — no palette fixes that. The icon is what
 * makes "Needs Revision" distinguishable from a failure, not the hue.
 */
const STATUS: Record<
  SubmissionStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  SUBMITTED: {
    label: "Submitted",
    icon: Clock,
    className: "bg-warning-subtle text-warning ring-warning/20",
  },
  NEEDS_REVISION: {
    label: "Needs Revision",
    icon: Undo2,
    className: "bg-destructive-subtle text-destructive ring-destructive/20",
  },
  CONFIRMED: {
    label: "Confirmed",
    icon: CheckCircle2,
    className: "bg-brand-subtle text-brand ring-brand/20",
  },
  SENT: {
    label: "Sent",
    icon: Send,
    className: "bg-success-subtle text-success ring-success/20",
  },
};

export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.className,
        className
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {s.label}
    </span>
  );
}

/** Active/inactive for people records — same icon-plus-word rule. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        active
          ? "bg-success-subtle text-success ring-success/20"
          : "bg-muted text-muted-foreground ring-border"
      )}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground/60")}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}
