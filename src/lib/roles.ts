import type { UserRole } from "@prisma/client";

// Display name only — the DEPARTMENT_HEAD enum value, route group, and
// field names (departmentHeadName/Email) are unchanged, since renaming
// those would mean a schema migration for a label change. "Department
// Head" implied one specific person; in practice anyone on the team
// submits their teammates' feedback, so the app now calls the role what it
// actually is. Access is identical — still scoped to exactly one
// department, still the person a submission is attributed to.
export const ROLE_LABEL: Record<UserRole, string> = {
  DEPARTMENT_HEAD: "Team Lead",
  HR: "HR",
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
};

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = (
  Object.keys(ROLE_LABEL) as UserRole[]
).map((value) => ({ value, label: ROLE_LABEL[value] }));

/** Where each role lands after login (§27 nav). */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "DEPARTMENT_HEAD":
      return "/review";
    case "HR":
      return "/overview";
    case "ADMIN":
      // Admin is a superset of HR, so the operational dashboard is a more
      // useful landing than the setup screens.
      return "/overview";
    case "EMPLOYEE":
      // Signed in through People with no Review duties: their own scorecard.
      return "/performance";
  }
}
