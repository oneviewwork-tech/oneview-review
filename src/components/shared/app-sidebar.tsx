"use client";

import Link from "next/link";
import Image from "next/image";
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/shared/user-menu";
import type { NavSection, NavIcon } from "@/lib/navigation";
import type { NavBadges } from "@/services/review/nav-badges";

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
  badges,
  signOut,
}: {
  sections: NavSection[];
  userName: string;
  userMeta: string;
  /** Outstanding work, keyed by nav href. */
  badges: NavBadges;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  // Group headings earn their space only when there is more than one group
  // to tell apart. For a Department Head or HR — who see a single group —
  // the heading just repeats the product name back at them.
  const showSectionLabels = sections.length > 1;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-w)] flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <Image
          src="/oneview-review-mark.png"
          alt=""
          width={34}
          height={34}
          priority
          className="h-[34px] w-[34px] rounded-[10px] ring-1 ring-border"
        />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-bold tracking-tight text-foreground">ONEVIEW</span>
          <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Review
          </span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {sections.map((section) => (
          <div key={section.label} className={showSectionLabels ? "mb-5" : "mb-2"}>
            {showSectionLabels && <p className="text-eyebrow px-2.5 pb-1.5">{section.label}</p>}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const count = badges[item.href] ?? 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg py-2 pl-3 pr-2 text-sm transition-ui",
                        active
                          ? "bg-brand-subtle font-semibold text-brand"
                          : "font-medium text-foreground hover:bg-accent"
                      )}
                    >
                      {/* A rail rather than only a fill: it marks the edge of
                          the nav so the current page is findable in
                          peripheral vision. */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-ui",
                          active ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-ui",
                          active ? "text-brand" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span
                          // Titled, because a bare number in a nav is only
                          // meaningful if you already know what it counts.
                          title={`${count} waiting on you`}
                          className={cn(
                            "flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                            active ? "bg-brand text-brand-foreground" : "bg-brand/10 text-brand"
                          )}
                        >
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2.5">
        <UserMenu userName={userName} userMeta={userMeta} signOut={signOut} />
      </div>
    </aside>
  );
}
