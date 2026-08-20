import { cva } from "class-variance-authority";

// Kept out of button.tsx deliberately: that file is "use client", and a
// server component styling a <Link> as a button needs to call this at
// render time on the server.
export const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg",
    "text-sm font-semibold transition-ui",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    // A small, quick depress. Enough to feel responsive without looking
    // like the button is bouncing.
    "active:scale-[0.98] motion-reduce:active:scale-100",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground shadow-xs hover:bg-brand-hover hover:shadow-sm",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:brightness-110",
        outline: "border border-input bg-card text-foreground shadow-xs hover:border-brand/40 hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-95 dark:hover:brightness-110",
        ghost: "text-foreground hover:bg-accent",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
