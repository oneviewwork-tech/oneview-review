import { cn } from "@/lib/utils";

/**
 * The family lockup: the Haris&Co. wordmark, a hairline, then the product
 * name — the same arrangement ONEVIEW People uses, so someone moving
 * between the two apps sees one company rather than two products.
 *
 * The wordmark is deliberately tight-kerned ("Haris&Co.", no spaces around
 * the ampersand); only prose spells it out normally.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="font-brand text-[17px] font-bold leading-none tracking-tight text-foreground">
        Haris&amp;Co.
      </span>
      <span aria-hidden className="h-4 w-px bg-border" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Review</span>
    </div>
  );
}
