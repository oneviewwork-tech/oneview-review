"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/** Segments that are route plumbing, not places a person navigated to. */
const HIDDEN = new Set(["admin"]);

const LABELS: Record<string, string> = {
  overview: "Overview",
  submissions: "Submissions",
  "email-history": "Email History",
  review: "New Review",
  "my-submissions": "My Submissions",
  departments: "Departments",
  employees: "Employees",
  users: "Users",
  revise: "Revise",
  "change-password": "Change password",
};

/**
 * Where you are, derived from the URL.
 *
 * Record ids are rendered as "Details" rather than as a cuid — the id is
 * meaningless to read and would swamp the trail.
 */
export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).filter((s) => !HIDDEN.has(s));

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {segments.map((segment, i) => {
          const last = i === segments.length - 1;
          const isId = /^[a-z0-9]{20,}$/i.test(segment);
          const label = isId ? "Details" : (LABELS[segment] ?? segment.replace(/-/g, " "));
          const href = "/" + segments.slice(0, i + 1).join("/");

          return (
            <li key={segment + i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
              {last ? (
                <span aria-current="page" className="truncate font-semibold capitalize text-foreground">
                  {label}
                </span>
              ) : (
                <Link href={href} className="truncate capitalize text-muted-foreground transition-ui hover:text-foreground">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
