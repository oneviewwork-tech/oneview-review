"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Pill tabs for Users & Roles; each tab's content is rendered on the server and handed in. */
export function RoleTabs({
  tabs,
  initial,
}: {
  tabs: { id: string; label: string; count: number; icon: React.ReactNode; content: React.ReactNode }[];
  initial?: string;
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="mt-6">
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-card p-1.5 shadow-sm sm:w-fit" role="tablist">
        {tabs.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-ui",
                on ? "bg-ink text-ink-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", on ? "bg-white/15" : "bg-muted")}>{t.count}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-5">{current.content}</div>
    </div>
  );
}
