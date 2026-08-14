import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-up flex flex-col items-center justify-center rounded-xl border border-border bg-card py-14 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-subtle">
        <Inbox className="h-5 w-5 text-brand" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
