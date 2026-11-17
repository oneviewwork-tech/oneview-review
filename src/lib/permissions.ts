import type { ReviewPermission, UserRole } from "@prisma/client";

/**
 * Every permission Review knows, grouped for the Users & Roles screen.
 *
 * Roles are rows in the database (ReviewRole): the four built-in ones below
 * plus any an admin creates. A role carries a set of these permissions and,
 * optionally, a pin to one organization. Every server-side check asks for a
 * permission (requirePermission in rbac.ts) — never for a role name — so a
 * custom role like "HR · HACA" works everywhere without code knowing it.
 *
 * Some access isn't a permission at all and comes from the data: who you
 * score (assignments), who reviews you (the scoring tree), and which
 * department a Team Lead submits feedback for.
 */
export interface PermissionDef {
  key: ReviewPermission;
  label: string;
  description: string;
}

export const PERMISSION_GROUPS: { key: string; label: string; permissions: PermissionDef[] }[] = [
  {
    key: "performance",
    label: "Performance",
    permissions: [
      { key: "PERF_VIEW_ALL", label: "View all scorecards", description: "See every person's scorecard and the organization dashboards, not just their own tree." },
      { key: "PERF_SCORE_ANY", label: "Score for anyone", description: "Enter weekly scores and critical KPIs for anyone, acting for their scorer." },
      { key: "PERF_DECIDE_ANY", label: "Confirm any month", description: "Confirm or send back any submitted month, not just the ones they review." },
      { key: "PERF_SETUP", label: "Manage scorecards", description: "Create and edit scorecards, and decide who scores whom." },
      { key: "PERF_GRADE_SETTINGS", label: "Change grade cut-offs", description: "Set the A / B / C and health cut-offs used across reports." },
      { key: "PERF_SEND_REMINDERS", label: "Send reminders", description: "Email scorers and reviewers about outstanding months." },
    ],
  },
  {
    key: "feedback",
    label: "Feedback",
    permissions: [
      { key: "FEEDBACK_SUBMIT_ANY", label: "Submit feedback for anyone", description: "Use the feedback form for any department, not only their own." },
      { key: "FEEDBACK_REVIEW", label: "Review feedback", description: "See every submission; confirm it or send it back for changes." },
      { key: "FEEDBACK_SEND", label: "Send feedback emails", description: "Send confirmed feedback to employees, one by one or all at once." },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    permissions: [
      { key: "EMPLOYEES_MANAGE", label: "Manage employees", description: "Add and edit employees, and sync them with ONEVIEW People." },
      { key: "USERS_MANAGE", label: "Manage user accounts", description: "Give people a role, change it, and deactivate accounts." },
      { key: "ROLES_MANAGE", label: "Manage roles", description: "Create roles and change what each role can do." },
      { key: "DEPARTMENTS_MANAGE", label: "Manage departments", description: "Create and rename departments." },
    ],
  },
];

export const ALL_PERMISSIONS: ReviewPermission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
export const PERMISSION_LABEL = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label]))) as Record<
  ReviewPermission,
  string
>;

/**
 * The built-in roles. Their ids are fixed (the migration creates them and
 * existing users are attached by their old role); names and permissions of
 * system roles can't be deleted, only a custom copy changed.
 */
export const SYSTEM_ROLES: {
  id: string;
  name: string;
  baseRole: UserRole;
  isSuperAdmin: boolean;
  description: string;
  permissions: ReviewPermission[];
}[] = [
  {
    id: "role_admin",
    name: "Admin",
    baseRole: "ADMIN",
    isSuperAdmin: true,
    description: "Everything, in every organization.",
    permissions: ALL_PERMISSIONS,
  },
  {
    id: "role_hr",
    name: "HR",
    baseRole: "HR",
    isSuperAdmin: false,
    description: "Runs performance and feedback for the organization; manages employees and accounts.",
    permissions: [
      "PERF_VIEW_ALL",
      "PERF_SETUP",
      "PERF_GRADE_SETTINGS",
      "PERF_SEND_REMINDERS",
      "FEEDBACK_REVIEW",
      "FEEDBACK_SEND",
      "EMPLOYEES_MANAGE",
      "USERS_MANAGE",
    ],
  },
  {
    id: "role_team_lead",
    name: "Team Lead",
    baseRole: "DEPARTMENT_HEAD",
    isSuperAdmin: false,
    description: "Submits monthly feedback for their own department.",
    permissions: [],
  },
  {
    id: "role_employee",
    name: "Employee",
    baseRole: "EMPLOYEE",
    isSuperAdmin: false,
    description: "Sees their own scorecard; scores whoever they're assigned.",
    permissions: [],
  },
];

/** The built-in role for a base role — used for anyone not yet attached to a role row. */
export const systemRoleFor = (base: UserRole) => SYSTEM_ROLES.find((r) => r.baseRole === base)!;

/** What a base role means, for the "type" chosen when creating a role. */
export const BASE_ROLE_HINT: Record<UserRole, string> = {
  ADMIN: "Full access everywhere (only the built-in Admin role should use this).",
  HR: "Organization-wide screens: dashboards, Feedback Review and Administration.",
  DEPARTMENT_HEAD: "A Team Lead: submits feedback for one department.",
  EMPLOYEE: "An ordinary account: their own scorecard, plus anyone they're assigned to score.",
};
