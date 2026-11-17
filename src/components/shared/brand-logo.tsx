import { cn } from "@/lib/utils";

export type Brand = "harisco" | "haca" | "all";

/** Which mark an organization code gets: HACA's own, or Haris&Co.'s. */
export const brandForOrgCode = (code: string | null | undefined): Brand => (code?.startsWith("HACA") ? "haca" : "harisco");

/**
 * The family lockup, as in ONEVIEW People: the organization's wordmark, a
 * hairline, then the product name. Haris&Co. is the rounded Fredoka mark
 * (tight-kerned, no spaces around the ampersand); HACA is a heavy grotesk in
 * its own blue. "all" — HR or Admin looking at both — shows them side by side.
 */
/** `stacked`: the product name sits under the marks (narrow places such as the sidebar). */
export function BrandLogo({ brand = "harisco", className, stacked }: { brand?: Brand; className?: string; stacked?: boolean }) {
  const harisCo = <span className="font-brand text-[17px] font-bold leading-none tracking-tight text-foreground">Haris&amp;Co.</span>;
  const haca = <span className="font-sans text-[17px] font-black leading-none tracking-[-0.04em] text-[#1f4fff]">HACA</span>;
  return (
    <div className={cn("flex whitespace-nowrap", stacked ? "flex-col items-start gap-1" : "items-center gap-2.5", className)}>
      {brand === "haca" ? (
        haca
      ) : brand === "all" ? (
        <span className="inline-flex items-baseline gap-1.5">
          {harisCo}
          <span className="text-xs font-medium text-muted-foreground">×</span>
          {haca}
        </span>
      ) : (
        harisCo
      )}
      {!stacked && <span aria-hidden className="h-4 w-px bg-border" />}
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Review</span>
    </div>
  );
}
