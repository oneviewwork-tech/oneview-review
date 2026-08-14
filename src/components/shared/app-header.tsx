import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/actions/auth.actions";

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
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand">OneView</span>
            <span className="text-sm font-semibold text-foreground">Review</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-metadata">{userMeta}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
