import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";
import { signOutAction } from "@/actions/auth.actions";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { NavLink } from "@/components/shared/nav-link";

export interface NavItem {
  href: string;
  label: string;
}

export function AppHeader({
  navItems,
  userName,
  userMeta,
}: {
  navItems: NavItem[];
  userName: string;
  userMeta: string;
}) {
  return (
    <header className="glass-panel sticky top-0 z-20 border-b border-border">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide gradient-text">ONEVIEW</span>
            <span className="text-sm font-semibold text-foreground">Review</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="mr-1.5 text-right leading-tight">
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-metadata">{userMeta}</p>
          </div>
          <ThemeToggle />
          <Link
            href="/change-password"
            aria-label="Change password"
            title="Change password"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
          >
            <KeyRound className="h-4 w-4" />
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
