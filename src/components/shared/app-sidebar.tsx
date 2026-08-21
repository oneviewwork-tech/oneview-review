"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PenSquare,
  ClipboardList,
  LayoutDashboard,
  Inbox,
  Mail,
  Building2,
  Users,
  UserCog,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/shared/brand-logo";
import { CycleCard } from "@/components/shared/cycle-card";
import type { NavSection, NavIcon } from "@/lib/navigation";
import type { NavBadges, SidebarCycle } from "@/services/review/sidebar";

const ICONS: Record<NavIcon, LucideIcon> = {
  PenSquare,
  ClipboardList,
  LayoutDashboard,
  Inbox,
  Mail,
  Building2,
  Users,
  UserCog,
};

/**
 * Laid out to match ONEVIEW People: wordmark lockup, then the signed-in
 * person in a card at the top, then grouped navigation. Someone who uses
 * both products should not have to relearn where anything is.
 */
export function AppSidebar({
  sections,
  userName,
  userMeta,
  badges,
  cycle,
  signOut,
}: {
  sections: NavSection[];
  userName: string;
  userMeta: string;
  /** Outstanding work, keyed by nav href. */
  badges: NavBadges;
  cycle: SidebarCycle;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-w)] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 shrink-0 items-center px-4">
        <BrandLogo />
      </div>

      {/* The account sits at the top, as in People — it identifies whose
          data you are looking at before you read any of it. */}
      <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl bg-muted p-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
          {initials}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
          <p className="truncate text-xs text-muted-foreground">{userMeta}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-card hover:text-destructive active:scale-95"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const count = badges[item.href] ?? 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-ui",
                    active
                      ? "bg-brand font-semibold text-brand-foreground shadow-xs"
                      : "font-medium text-foreground hover:bg-accent"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-ui motion-safe:group-hover:scale-110",
                      active ? "text-brand-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {count > 0 && (
                    <span
                      // Titled, because a bare number in a nav only means
                      // something if you already know what it counts.
                      title={`${count} waiting on you`}
                      className={cn(
                        "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        active ? "bg-white/25 text-brand-foreground" : "bg-brand text-brand-foreground"
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* This product has far fewer destinations than People, so the column
          would otherwise trail off into empty space. The cycle summary is
          the one thing worth knowing from every page. */}
      <div className="shrink-0 border-t border-sidebar-border p-2.5">
        <CycleCard cycle={cycle} />
      </div>
    </aside>
  );
}
