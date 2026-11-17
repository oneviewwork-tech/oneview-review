"use client";

import { use } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PenSquare,
  ClipboardList,
  LayoutDashboard,
  Inbox,
  Mail,
  Building2,
  Users,
  UserCog,
  Gauge,
  Target,
  ListChecks,
  ClipboardCheck,
  Link2,
  LogOut,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo, type Brand } from "@/components/shared/brand-logo";
import type { NavSection, NavIcon, NavItem } from "@/lib/navigation";
import type { NavBadges } from "@/services/review/sidebar";

const ICONS: Record<NavIcon, LucideIcon> = {
  PenSquare,
  ClipboardList,
  LayoutDashboard,
  Inbox,
  Mail,
  Building2,
  Users,
  UserCog,
  Gauge,
  Target,
  ListChecks,
  ClipboardCheck,
  Link2,
  Table2,
};

/** Tiny spinner shown on the pill you just clicked, until the next page is ready. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      aria-hidden
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
    />
  ) : null;
}

const isPromise = <T,>(v: T | Promise<T>): v is Promise<T> =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as { then?: unknown }).then === "function";

/**
 * The app's one navigation: a rounded pill menu across the top, one pill per
 * section. Sections with several destinations show them as a second row of
 * smaller pills, so the top row stays short however many pages a role has.
 *
 * Presentation only — the real access boundary is the proxy's route table and
 * the server-side checks on every page and action.
 */
export function AppTopNav({
  sections,
  userName,
  userMeta,
  badges,
  signOut,
  switcher,
  bell,
  homeBrand,
  seesAllOrgs,
}: {
  sections: NavSection[];
  userName: string;
  userMeta: string;
  /**
   * Outstanding work, keyed by nav href. May be a promise: the counts are
   * streamed in after the page itself, so a slow query never holds the menu
   * (or anything under it) up.
   */
  badges: NavBadges | Promise<NavBadges>;
  signOut: () => Promise<void>;
  /** Test-only account switcher, when enabled (local test database). */
  switcher?: React.ReactNode;
  /** The notification bell (server-rendered, streamed). */
  bell?: React.ReactNode;
  /** The mark for the signed-in person's own organization. */
  homeBrand: Brand;
  /** HR / Admin: the mark follows the organization picked in the filter (both when none). */
  seesAllOrgs: boolean;
}) {
  const pathname = usePathname();
  const org = useSearchParams().get("org");
  // As in People: HR/Admin see whichever organization they've filtered to,
  // or both marks when looking at all; everyone else sees their own.
  const brand: Brand = seesAllOrgs ? (!org || org === "all" ? "all" : org.includes("haca") ? "haca" : "harisco") : homeBrand;
  const resolvedBadges = isPromise(badges) ? use(badges) : badges;

  // The Performance dashboard is the parent of its sibling pages (Score Team,
  // Scorecards...), so it matches exactly or it would stay highlighted next to
  // whichever of them is open. A person's page belongs to the dashboard.
  const isActive = (item: NavItem) =>
    item.href === "/performance"
      ? pathname === item.href || pathname.startsWith("/performance/people/")
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const activeSection =
    sections.find((s) => s.items.some(isActive)) ?? sections[0];
  const countFor = (s: NavSection) =>
    s.items.reduce((sum, i) => sum + (resolvedBadges[i.href] ?? 0), 0);

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Sticky, but no band behind it: each pill floats on its own over the
        page. The header itself ignores clicks so the gaps between pills don't
        block the content scrolling underneath. */}
      <header className="pointer-events-none sticky top-3 z-30 sm:top-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link
            href="/"
            aria-label="ONEVIEW Review home"
            className="pointer-events-auto flex h-12 shrink-0 items-center rounded-full bg-card px-5 shadow-md"
          >
            <BrandLogo brand={brand} />
          </Link>

          <nav
            aria-label="Main"
            className="order-3 w-full min-w-0 md:order-none md:w-auto md:flex-1"
          >
            <div className="no-scrollbar pointer-events-auto mx-auto flex w-fit max-w-full snap-x gap-1 overflow-x-auto rounded-full bg-card p-1.5 shadow-md">
              {sections.map((section) => {
                const active = section === activeSection;
                const count = countFor(section);
                return (
                  <Link
                    key={section.label}
                    href={section.items[0].href}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex shrink-0 snap-start items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium 2xl:px-4 transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-ink text-ink-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-card hover:text-foreground",
                    )}
                  >
                    {section.label}
                    <Pending />
                    {count > 0 && (
                      <span
                        title={`${count} waiting on you`}
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chart-pink px-1.5 text-[11px] font-semibold tabular-nums text-white"
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-2">
            {switcher}
          {bell}
            <div className="flex h-12 items-center gap-2.5 rounded-full bg-card pl-2 pr-2 shadow-md">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-ink-foreground">
                {initials}
              </span>
              <span className="hidden min-w-0 leading-tight sm:block">
                <span className="block max-w-36 truncate text-sm font-semibold">
                  {userName}
                </span>
                <span className="block max-w-36 truncate text-xs text-muted-foreground">
                  {userMeta}
                </span>
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-ui hover:bg-accent hover:text-destructive active:scale-95"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-pages scroll away with the page; only the top row stays. */}
      {activeSection.items.length > 1 && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:mt-4 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          {activeSection.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item);
            const count = resolvedBadges[item.href] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-brand-subtle font-semibold text-brand"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
                <Pending />
                {count > 0 && (
                  <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold tabular-nums text-brand-foreground">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
