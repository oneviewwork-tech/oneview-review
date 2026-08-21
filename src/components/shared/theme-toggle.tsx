"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDarkTheme, setDarkTheme } from "@/lib/use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useIsDarkTheme();

  return (
    <button
      type="button"
      onClick={() => setDarkTheme(!isDark)}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground active:scale-95",
        className
      )}
    >
      {/* Null until the client knows the theme — rendering either icon on
          the server would flash the wrong one. */}
      {isDark === null ? null : isDark ? (
        <Sun className="h-4 w-4 animate-scale-in" />
      ) : (
        <Moon className="h-4 w-4 animate-scale-in" />
      )}
    </button>
  );
}
