"use client";

import { useEffect, useRef, useTransition } from "react";
import { ArrowLeftRight, Check } from "lucide-react";
import { switchAccountAction } from "@/actions/auth.actions";
import { cn } from "@/lib/utils";

export interface SwitchableAccount {
  email: string;
  name: string;
  roleLabel: string;
}

/**
 * Test-only: jump between accounts in one click. Rendered only when the
 * switcher is enabled (local test database, dev build); the server action
 * and the sign-in provider check that again themselves.
 */
export function AccountSwitcher({ accounts, currentEmail }: { accounts: SwitchableAccount[]; currentEmail: string }) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDetailsElement>(null);

  // Close on an outside click, like any other menu.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        title="Switch account (test only)"
        aria-label="Switch account (test only)"
        className={cn(
          "flex size-12 cursor-pointer list-none items-center justify-center rounded-full border-2 border-dashed border-chart-pink bg-card text-chart-pink shadow-md transition-ui hover:bg-accent [&::-webkit-details-marker]:hidden",
          pending && "animate-pulse"
        )}
      >
        <ArrowLeftRight className="size-4" />
      </summary>
      <div className="popover-panel absolute right-0 top-full z-40 mt-2 w-72 p-1.5">
        <p className="px-2.5 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-chart-pink">Test accounts</p>
        {accounts.map((a) => {
          const current = a.email === currentEmail;
          return (
            <button
              key={a.email}
              type="button"
              disabled={pending || current}
              onClick={() => start(() => switchAccountAction(a.email))}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.roleLabel} · {a.email}
                </span>
              </span>
              {current && <Check className="size-4 shrink-0 text-brand" />}
            </button>
          );
        })}
      </div>
    </details>
  );
}
