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
  KeyRound,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { NavSection, NavIcon } from "@/lib/navigation";

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

export function AppSidebar({
  sections,
  userName,
  userMeta,
  signOut,
}: {
  sections: NavSection[];
  userName: string;
  userMeta: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-w)] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-brand-foreground">
          O
        </span>
        <span className="text-[15px] font-bold tracking-tight text-foreground">
          ONEVIEW <span className="font-semibold text-muted-foreground">Review</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {sections.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-ui",
                        active
                          ? "bg-brand-subtle text-brand"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", !active && "text-muted-foreground")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
            {initials}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-metadata">{userMeta}</p>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-0.5">
          <ThemeToggle />
          <Link
            href="/change-password"
            aria-label="Change password"
            title="Change password"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
          >
            <KeyRound className="h-4 w-4" />
          </Link>
          <form action={signOut} className="ml-auto">
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
