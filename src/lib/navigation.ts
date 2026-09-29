import type { UserRole } from "@prisma/client";

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
  | "UserCog";

export interface NavSection {
  label: string;
  items: NavItem[];
}

const REVIEW_SECTION: NavSection = {
  label: "Performance Review",
  items: [
    { href: "/review", label: "New Review", icon: "PenSquare" },
    { href: "/my-submissions", label: "My Submissions", icon: "ClipboardList" },
  ],
};

const HR_SECTION: NavSection = {
  label: "HR Workspace",
  items: [
    { href: "/overview", label: "Overview", icon: "LayoutDashboard" },
    { href: "/submissions", label: "Submissions", icon: "Inbox" },
    { href: "/email-history", label: "Email History", icon: "Mail" },
  ],
};

const EMPLOYEES_NAV_ITEM: NavItem = { href: "/admin/employees", label: "Employees", icon: "Users" };

const ADMIN_SECTION: NavSection = {
  label: "Administration",
  items: [{ href: "/admin/departments", label: "Departments", icon: "Building2" }, EMPLOYEES_NAV_ITEM, { href: "/admin/users", label: "Users", icon: "UserCog" }],
};

// HR can maintain employee records (§26: HR already sees every employee)
// but not departments or user accounts — those stay Admin-only.
const HR_ADMIN_SECTION: NavSection = {
  label: "Administration",
  items: [EMPLOYEES_NAV_ITEM],
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
 * requireReviewAccess()/requireHrAccess()/requireAdmin() plus the route
 * matcher in proxy.ts; this list must never be the only thing keeping a
 * role out of a page.
 */
export function navigationForRole(role: UserRole): NavSection[] {
  switch (role) {
    case "DEPARTMENT_HEAD":
      return [REVIEW_SECTION];
    case "HR":
      return [HR_SECTION, HR_ADMIN_SECTION];
    case "ADMIN":
      return [HR_SECTION, REVIEW_SECTION, ADMIN_SECTION];
  }
}
