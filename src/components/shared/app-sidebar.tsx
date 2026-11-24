"use client";

import { Suspense, use, useState, useSyncExternalStore } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo, type Brand } from "@/components/shared/brand-logo";
import { Dropdown } from "@/components/ui/dropdown";
import { setOrgScope } from "@/actions/org-scope.actions";
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

// ── Remembered UI state (per browser; the server always renders expanded) ──
const EXPANDED_KEY = "oneview.review.sidebar.expanded";
const GROUPS_KEY = "oneview.review.sidebar.collapsedGroups";
const listeners = new Set<() => void>();
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useStored = (key: string, fallback: string) =>
  useSyncExternalStore(subscribe, () => read(key) ?? fallback, () => fallback);

/** Tiny spinner on the link you just clicked, until the next page is ready. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" /> : null;
}

const isPromise = <T,>(v: T | Promise<T>): v is Promise<T> => typeof v === "object" && v !== null && typeof (v as { then?: unknown }).then === "function";

/** A link's outstanding-work count. Waits for the streamed counts on its own, so nothing else does. */
function Count({ badges, href, dark, dot }: { badges: NavBadges | Promise<NavBadges>; href: string; dark?: boolean; dot?: boolean }) {
  const n = (isPromise(badges) ? use(badges) : badges)[href] ?? 0;
  if (dot) return n > 0 ? <span className="absolute right-1 top-1 size-2 rounded-full bg-chart-pink ring-2 ring-white" /> : null;
  return n > 0 ? (
    <span className={cn("ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums", dark ? "bg-white/20 text-white" : "bg-chart-pink text-white")}>
      {n > 99 ? "99+" : n}
    </span>
  ) : null;
}

/**
 * The app's navigation, in the ONEVIEW family's floating-sidebar style (as in
 * ONEVIEW Ops): a plain white panel, pill links, groups
 * that fold away with a tree line, and a collapsed icon rail. On phones it is
 * a compact top bar whose menu button slides the same panel in.
 *
 * Presentation only: the real access boundary is the server-side checks on
 * every page and action.
 */
export function AppSidebarLayout({
  sections,
  userName,
  userMeta,
  userPhoto,
  badges,
  signOut,
  switcher,
  bell,
  brand,
  orgSwitch,
  peopleUrl,
  children,
}: {
  sections: NavSection[];
  userName: string;
  userMeta: string;
  /** Their photo from ONEVIEW People, when they have one. */
  userPhoto?: string;
  /** Outstanding work keyed by nav href; may stream in after the page. */
  badges: NavBadges | Promise<NavBadges>;
  signOut: () => Promise<void>;
  /** Test-only account switcher, when enabled (local test database). */
  switcher?: React.ReactNode;
  /** The notification bell (server-rendered, streamed). */
  bell?: React.ReactNode;
  /** The mark: the organization in view (both when all are). */
  brand: Brand;
  /** People who can see several organizations pick one here; it holds on every page. */
  orgSwitch?: { options: { id: string; name: string }[]; selected: string | null };
  /** ONEVIEW People's address: a "Back to People" link at the top of the sidebar. Hidden when not set. */
  peopleUrl?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  // Picking an organization: remember it, drop any page filters that pointed
  // into the previous one, and re-render the page for the new one.
  const switchOrg = async (id: string) => {
    setSwitching(true);
    await setOrgScope(id);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("org");
    params.delete("department");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
    setSwitching(false);
  };

  const expanded = useStored(EXPANDED_KEY, "true") === "true";
  const collapsedGroups: Record<string, boolean> = JSON.parse(useStored(GROUPS_KEY, "{}"));
  const toggleGroup = (label: string) => write(GROUPS_KEY, JSON.stringify({ ...collapsedGroups, [label]: !collapsedGroups[label] }));

  const [drawer, setDrawer] = useState(false);

  // The dashboard is the parent of its sibling pages, so it matches exactly;
  // a person's page belongs to it.
  const isActive = (item: NavItem) =>
    item.href === "/performance" ? pathname === item.href || pathname.startsWith("/performance/people/") : pathname === item.href || pathname.startsWith(item.href + "/");

  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  // ── One link ──
  const sideLink = (item: NavItem, wide: boolean, nested = false) => {
    const Icon = ICONS[item.icon];
    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={!wide ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative mb-1 flex items-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          wide ? cn("gap-3", nested ? "px-3.5 py-2 text-[13px]" : "px-4 py-2.5 text-[14px]") : "mx-auto size-11 justify-center",
          active
            ? nested && wide
              ? "bg-brand-subtle font-semibold text-ink"
              : "bg-gradient-to-b from-slate-800 to-ink font-semibold text-white shadow-[0_8px_18px_-8px_rgba(15,23,42,0.55)]"
            : "font-medium text-foreground/75 hover:bg-brand/[0.08] hover:text-foreground"
        )}
      >
        {(!nested || !wide) && <Icon className={cn("size-[19px] shrink-0", active ? "text-white" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={1.75} />}
        {wide && <span className="truncate">{item.label}</span>}
        {wide && <Pending />}
        <Suspense fallback={null}>
          <Count badges={badges} href={item.href} dark={active && !nested} dot={!wide} />
        </Suspense>
      </Link>
    );
  };

  // ── A section: a folding group with a tree line (a lone page is just a link) ──
  const group = (section: NavSection, wide: boolean) => {
    if (!wide) {
      return (
        <div key={section.label}>
          <div className="mx-auto my-3 h-px w-8 bg-border" aria-hidden />
          {section.items.map((item) => sideLink(item, false))}
        </div>
      );
    }
    if (section.items.length === 1) {
      return (
        <div key={section.label} className="mt-3">
          {sideLink(section.items[0], true)}
        </div>
      );
    }
    // A group holding the current page never shows folded, or you'd lose your place.
    const open = !collapsedGroups[section.label] || section.items.some(isActive);
    return (
      <div key={section.label} className="mt-1">
        <button
          type="button"
          onClick={() => toggleGroup(section.label)}
          aria-expanded={open}
          className="group flex w-full items-center justify-between rounded-xl px-3 pb-2 pt-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/80 group-hover:text-ink">{section.label}</span>
          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform duration-200", !open && "-rotate-90")} strokeWidth={2} />
        </button>
        {open && (
          <div className="relative ml-[21px] border-l border-border pl-2.5">
            {section.items.map((item) => sideLink(item, true, true))}
          </div>
        )}
      </div>
    );
  };

  // ── The panel itself (desktop rail, or the phone drawer when wide is forced) ──
  const panel = (wide: boolean, onClose?: () => void) => (
    <div className="sidebar-aurora relative flex h-full flex-col overflow-hidden rounded-[24px]">
      {peopleUrl && (
        <div className={cn("shrink-0 pt-4", wide ? "px-4" : "flex justify-center px-2")}>
          <a
            href={peopleUrl}
            aria-label="Back to ONEVIEW People"
            title="Back to ONEVIEW People"
            className={cn(
              "group flex items-center gap-2 rounded-full border border-border bg-white/80 text-[13px] font-medium text-muted-foreground shadow-[0_2px_6px_rgba(15,23,42,0.08)] transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              wide ? "w-full px-3 py-2" : "size-10 justify-center",
            )}
          >
            <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
            {wide && <span className="truncate">Back to People</span>}
          </a>
        </div>
      )}
      <div className={cn("flex shrink-0 items-center gap-2", peopleUrl ? "pt-4" : "pt-5", wide ? "px-5" : "flex-col px-2")}>
        <Link href="/" aria-label="ONEVIEW Review home" className="min-w-0">
          {wide ? <BrandLogo brand={brand} stacked /> : <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[13px] font-black text-ink shadow-sm ring-1 ring-black/5">R</span>}
        </Link>
        {!onClose && (
          <button
            type="button"
            onClick={() => write(EXPANDED_KEY, String(!expanded))}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse" : "Expand"}
            className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-[0_2px_6px_rgba(15,23,42,0.12)] transition-colors hover:text-foreground", wide && "ml-auto")}
          >
            {expanded ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" className="ml-auto flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-white">
            <X className="size-5" />
          </button>
        )}
      </div>

      {orgSwitch && orgSwitch.options.length > 1 &&
        (wide ? (
          <div className="mt-4 shrink-0 px-4">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/80">
              <Building2 className="size-3.5" /> Organization
              {switching && <span aria-hidden className="ml-auto size-3 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />}
            </p>
            <Dropdown
              className="w-full"
              value={orgSwitch.selected ?? "all"}
              onChange={switchOrg}
              options={[{ value: "all", label: "All organizations" }, ...orgSwitch.options.map((o) => ({ value: o.id, label: o.name }))]}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => write(EXPANDED_KEY, "true")}
            title={`Organization: ${orgSwitch.options.find((o) => o.id === orgSwitch.selected)?.name ?? "All organizations"}`}
            className="mx-auto mt-3 flex size-11 shrink-0 items-center justify-center rounded-full bg-white/70 text-muted-foreground ring-1 ring-black/[0.06] hover:text-foreground"
          >
            <Building2 className="size-[18px]" strokeWidth={1.75} />
          </button>
        ))}

      <nav
        aria-label="Main"
        // In the phone drawer, following a link closes it.
        onClick={onClose ? (e) => (e.target as HTMLElement).closest("a") && onClose() : undefined}
        className={cn("mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-3", wide ? "px-3" : "px-2")}>
        {sections.map((s) => group(s, wide))}
      </nav>

      {/* Footer: the signed-in person, then sign out. */}
      <div className={cn("shrink-0 space-y-2 border-t border-border/70", wide ? "p-3" : "px-2 py-3")}>
        {switcher && wide && <div className="flex justify-center">{switcher}</div>}
        <div className={cn("flex items-center rounded-2xl bg-white/70 ring-1 ring-black/[0.06]", wide ? "gap-2.5 p-2" : "mx-auto size-12 justify-center")} title={!wide ? `${userName} · ${userMeta}` : undefined}>
          {userPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own authed thumbnail route
            <img src={userPhoto} alt="" className="size-8 shrink-0 rounded-full object-cover ring-2 ring-white" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-ink-foreground">{initials}</span>
          )}
          {wide && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">{userName}</span>
              <span className="block truncate text-xs text-muted-foreground">{userMeta}</span>
            </span>
          )}
        </div>
        <form action={signOut}>
          <button
            type="submit"
            title={`Sign out (${userName})`}
            className={cn(
              "flex items-center rounded-2xl bg-white/70 text-muted-foreground ring-1 ring-black/[0.06] transition-colors hover:text-destructive",
              wide ? "w-full justify-center gap-2.5 px-3 py-3 text-[13.5px] font-medium" : "mx-auto size-12 justify-center"
            )}
          >
            <LogOut className="size-[18px] shrink-0" strokeWidth={1.75} />
            {wide && <span>Sign out</span>}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop: a fixed floating rail. */}
      <aside
        aria-label="Main navigation"
        className={cn("fixed inset-y-0 left-0 z-40 hidden p-3 transition-[width] duration-200 ease-out lg:block", expanded ? "w-[272px]" : "w-[92px]")}
      >
        {panel(expanded)}
      </aside>

      {/* Phone/tablet: the same panel as a drawer. */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] p-3 animate-fade-up">
            {panel(true, () => setDrawer(false))}
          </div>
        </div>
      )}

      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", expanded ? "lg:pl-[272px]" : "lg:pl-[92px]")}>
        {/* Top strip: menu + brand on phones; bell and switcher everywhere. */}
        <header className="sticky top-0 z-30 flex items-center gap-2 px-4 pt-3 sm:px-6 lg:justify-end lg:px-8 lg:pt-4">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="flex size-11 items-center justify-center rounded-full bg-card shadow-md lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/" aria-label="ONEVIEW Review home" className="flex h-11 min-w-0 items-center rounded-full bg-card px-4 shadow-md lg:hidden">
            <BrandLogo brand={brand} />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {switcher && <div className="lg:hidden">{switcher}</div>}
            {bell}
          </div>
        </header>
        <main className="w-full min-w-0 flex-1 px-4 pb-10 pt-2 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
