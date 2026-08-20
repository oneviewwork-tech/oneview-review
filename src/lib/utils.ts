import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge groups any unknown `text-*` class as a font-size utility,
 * so pairing one of our custom typography utilities with a colour
 * (`text-metric` + `text-brand`) made it silently drop the size. Declaring
 * them here puts each in its own group, so size and colour coexist.
 *
 * Any future `text-`prefixed utility added to globals.css must be listed
 * here too, or it will start eating colours again.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display",
        "text-page-title",
        "text-eyebrow",
        "text-page-subtitle",
        "text-section-title",
        "text-metric",
        "text-metric-lg",
        "text-metadata",
        "text-table",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
