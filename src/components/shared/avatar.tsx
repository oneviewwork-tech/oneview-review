import { cn } from "@/lib/utils";

/**
 * Initials avatar.
 *
 * Deliberately one neutral treatment rather than a hue per person: colour
 * here would carry no meaning, and the app reserves hue for status and for
 * the brand's own actions. The initials do the identifying.
 */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border",
        className
      )}
    >
      {initials}
    </span>
  );
}
