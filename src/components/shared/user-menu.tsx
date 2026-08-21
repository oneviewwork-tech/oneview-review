"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, KeyRound, LogOut, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDarkTheme, setDarkTheme } from "@/lib/use-theme";

/**
 * The account control at the foot of the sidebar.
 *
 * Replaces three unlabelled icon buttons sitting loose in a row — they were
 * easy to mis-click, gave no indication of what they did, and put "sign
 * out" one stray tap away from "change password". Everything now lives
 * behind one deliberate click, with words attached.
 */
export function UserMenu({
  userName,
  userMeta,
  signOut,
}: {
  userName: string;
  userMeta: string;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const isDark = useIsDarkTheme();
  const rootRef = useRef<HTMLDivElement>(null);

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggleTheme() {
    setDarkTheme(!isDark);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 text-left transition-ui",
          "hover:border-border hover:bg-accent",
          open && "border-border bg-accent"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
          {initials}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-foreground">{userName}</span>
          <span className="block truncate text-metadata">{userMeta}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="popover-panel animate-scale-in absolute bottom-full left-0 z-40 mb-2 w-[calc(100%+0.5rem)] origin-bottom p-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-ui hover:bg-accent"
          >
            {isDark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
            <span className="flex-1 text-left">{isDark ? "Light theme" : "Dark theme"}</span>
          </button>

          <Link
            href="/change-password"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-ui hover:bg-accent"
          >
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Change password
          </Link>

          <div className="my-1 h-px bg-border" />

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-destructive transition-ui hover:bg-destructive-subtle"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
