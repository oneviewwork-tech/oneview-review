import { cn } from "@/lib/utils";

/**
 * One page header for the whole app, so every screen announces itself the
 * same way: an optional eyebrow for context, the title, a one-line
 * explanation, and the page's primary action on the right.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-page-title">{title}</h1>
        {description && <p className="text-page-subtitle mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
