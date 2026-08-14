import type { UserRole } from "@prisma/client";

export const ROLE_LABEL: Record<UserRole, string> = {
  DEPARTMENT_HEAD: "Department Head",
  HR: "HR",
  ADMIN: "Admin",
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
      return "/admin";
  }
}
