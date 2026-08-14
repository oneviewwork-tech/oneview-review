"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-ui",
        active ? "text-brand" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
      {active && <span className="absolute inset-x-2.5 -bottom-[7px] h-0.5 rounded-full bg-gradient-brand" />}
    </Link>
  );
}
