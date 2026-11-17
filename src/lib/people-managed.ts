import type { UserRole } from "@prisma/client";

/**
 * Stored in place of a password on every Review user row: sign-in belongs to
 * ONEVIEW People. No bcrypt hash can ever equal this string, so a Review row
 * on its own can never sign anyone in.
 *
 * This file stays import-free (types only) so one-off scripts can use it
 * without pulling in the app's database client.
 */
export const PEOPLE_MANAGED = "!managed-by-oneview-people";

/**
 * The Review role a People account starts with the first time it appears in
 * Review. Afterwards the Review role is managed in Review (Admin -> Users): a
 * Team Lead is scoped to a department, which People has no notion of.
 */
export function initialReviewRole(identity: { isSuperAdmin: boolean; isStaffTier: boolean }): UserRole {
  if (identity.isSuperAdmin) return "ADMIN";
  if (identity.isStaffTier) return "HR";
  return "EMPLOYEE";
}
