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
export function BrandLogo({ brand = "harisco", className }: { brand?: Brand; className?: string }) {
  const harisCo = <span className="font-brand text-[17px] font-bold leading-none tracking-tight text-foreground">Haris&amp;Co.</span>;
  const haca = <span className="font-sans text-[17px] font-black leading-none tracking-[-0.04em] text-[#1f4fff]">HACA</span>;
  return (
    <div className={cn("flex items-center gap-2.5 whitespace-nowrap", className)}>
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
      <span aria-hidden className="h-4 w-px bg-border" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Review</span>
    </div>
  );
}
