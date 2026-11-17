import type { ReviewPermission, UserRole } from "@prisma/client";
import { systemRoleFor } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  /** lucide-react icon name, resolved in the client sidebar component. */
  icon: NavIcon;
}

export type NavIcon =
  | "PenSquare"
  | "ClipboardList"
  | "LayoutDashboard"
  | "Inbox"
  | "Mail"
  | "Building2"
  | "Users"
  | "UserCog"
  | "Gauge"
  | "Target"
  | "ListChecks"
  | "ClipboardCheck"
  | "Link2"
  | "Table2";

export interface NavSection {
  label: string;
  items: NavItem[];
}

const REVIEW_SECTION: NavSection = {
  label: "Feedback",
  items: [
    { href: "/review", label: "New Review", icon: "PenSquare" },
    { href: "/my-submissions", label: "My Submissions", icon: "ClipboardList" },
  ],
};

const HR_SECTION: NavSection = {
  label: "Feedback Review",
  items: [
    { href: "/overview", label: "Overview", icon: "LayoutDashboard" },
    { href: "/submissions", label: "Submissions", icon: "Inbox" },
    { href: "/email-history", label: "Email History", icon: "Mail" },
  ],
};

const PERFORMANCE_SECTION: NavSection = {
  label: "Performance",
  items: [
    { href: "/performance", label: "Dashboard", icon: "Gauge" },
    { href: "/performance/score", label: "Score Team", icon: "Target" },
    { href: "/performance/reviews", label: "Reviews", icon: "ClipboardCheck" },
  ],
};

const PERFORMANCE_SETUP_SECTION: NavSection = {
  label: "Performance Setup",
  items: [
    { href: "/performance/templates", label: "Scorecards", icon: "ListChecks" },
    { href: "/performance/assignments", label: "Assignments", icon: "Link2" },
  ],
};

const EMPLOYEES_NAV_ITEM: NavItem = { href: "/admin/employees", label: "Employees", icon: "Users" };

const USERS_NAV_ITEM: NavItem = { href: "/admin/users", label: "Users & Roles", icon: "UserCog" };

const ADMIN_SECTION: NavSection = {
  label: "Administration",
  items: [{ href: "/admin/departments", label: "Departments", icon: "Building2" }, EMPLOYEES_NAV_ITEM, USERS_NAV_ITEM],
};

// HR maintains employee records and decides who can do what in Review, but
// Departments stay Admin-only, and only an Admin can grant or change the
// Admin role (enforced in the server actions, not just here).
const HR_ADMIN_SECTION: NavSection = {
  label: "Administration",
  items: [EMPLOYEES_NAV_ITEM, USERS_NAV_ITEM],
};

/**
 * The whole app's navigation in one place, filtered by role.
 *
 * Every role gets the same shell and the same section grouping — only the
 * contents differ — so it reads as one product rather than three. ADMIN is
 * a deliberate superset: it sees and can do everything HR and a Department
 * Head can, plus system administration.
 *
 * This is presentation only. The real access boundary is
 * requirePermission() / requireReviewAccess() plus the route
 * matcher in proxy.ts; this list must never be the only thing keeping a
 * role out of a page.
 */
export function navigationForRole(
  role: UserRole,
  options: { employeeOnly?: boolean; can?: (permission: ReviewPermission) => boolean } = {}
): NavSection[] {
  // Scoring follows assignments, not roles. An employee who scores nobody
  // has exactly one thing here — their own scorecard — so that is all the
  // menu offers.
  if (options.employeeOnly) {
    return [{ label: "Performance", items: [{ href: "/performance", label: "My Scorecard", icon: "Gauge" }] }];
  }
  // Everything else follows the role's permissions, so a custom role sees
  // exactly the sections it can use.
  const fallback = systemRoleFor(role);
  const can = options.can ?? ((p: ReviewPermission) => fallback.isSuperAdmin || fallback.permissions.includes(p));
  const admin = [
    can("DEPARTMENTS_MANAGE") && { href: "/admin/departments", label: "Departments", icon: "Building2" as const },
    can("EMPLOYEES_MANAGE") && EMPLOYEES_NAV_ITEM,
    (can("USERS_MANAGE") || can("ROLES_MANAGE")) && USERS_NAV_ITEM,
  ].filter(Boolean) as NavItem[];
  // Everyone-in-view month-by-month table: for those who see every scorecard.
  const performance: NavSection = can("PERF_VIEW_ALL")
    ? {
        ...PERFORMANCE_SECTION,
        items: [PERFORMANCE_SECTION.items[0], { href: "/performance/employees", label: "Employee Performance", icon: "Table2" }, ...PERFORMANCE_SECTION.items.slice(1)],
      }
    : PERFORMANCE_SECTION;
  return [
    performance,
    can("PERF_SETUP") && PERFORMANCE_SETUP_SECTION,
    (can("FEEDBACK_REVIEW") || can("FEEDBACK_SEND")) && HR_SECTION,
    (role === "DEPARTMENT_HEAD" || can("FEEDBACK_SUBMIT_ANY")) && REVIEW_SECTION,
    admin.length > 0 && { label: "Administration", items: admin },
  ].filter(Boolean) as NavSection[];
}
