import { prisma } from "@/lib/prisma";

/**
 * Sign-in identity, read straight from ONEVIEW People.
 *
 * Review lives in its own `review` schema inside People's database, so the
 * People account tables are one schema over (`public`). They are read here
 * with explicit, schema-qualified SQL and never written: People owns
 * emails, passwords and who is active, Review only borrows them.
 */
export interface PeopleIdentity {
  peopleUserId: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  name: string;
  /** People's own role flags, used only to pick a sensible first Review role. */
  isSuperAdmin: boolean;
  isStaffTier: boolean;
}

interface Row {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  isStaffTier: boolean;
  firstName: string | null;
  lastName: string | null;
}

export async function findPeopleIdentity(email: string): Promise<PeopleIdentity | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT u."id", u."email", u."passwordHash", u."isActive",
           r."isSuperAdmin", r."isStaffTier",
           e."firstName", e."lastName"
    FROM "public"."User" u
    JOIN "public"."Role" r ON r."id" = u."roleId"
    LEFT JOIN "public"."Employee" e ON e."id" = u."employeeId"
    WHERE lower(u."email") = ${email.toLowerCase()}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;

  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email.split("@")[0];
  return {
    peopleUserId: row.id,
    email: row.email.toLowerCase(),
    passwordHash: row.passwordHash,
    isActive: row.isActive,
    name,
    isSuperAdmin: row.isSuperAdmin,
    isStaffTier: row.isStaffTier,
  };
}

export { PEOPLE_MANAGED, initialReviewRole } from "@/lib/people-managed";
