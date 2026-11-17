import { prisma } from "@/lib/prisma";

/**
 * Read-only views of ONEVIEW People's accounts, for the Users & Roles screen.
 * People owns who exists and who is active; Review only chooses what each
 * person may do here. Passwords are never selected.
 */
export interface PeopleAccount {
  email: string;
  name: string;
  designation: string | null;
  orgCode: string | null;
  /** The role they hold in People (informational — Review roles are separate). */
  peopleRole: string;
  isActive: boolean;
}

interface Row {
  email: string;
  name: string | null;
  designation: string | null;
  orgCode: string | null;
  role: string;
  isActive: boolean;
}

const toAccount = (r: Row): PeopleAccount => ({
  email: r.email,
  name: r.name?.trim() || r.email.split("@")[0],
  designation: r.designation,
  orgCode: r.orgCode,
  peopleRole: r.role,
  isActive: r.isActive,
});

/** Active People accounts whose name or email contains `query`. */
export async function searchPeopleAccounts(query: string, limit = 40): Promise<PeopleAccount[]> {
  const like = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT lower(u."email") AS email,
           e."firstName" || ' ' || e."lastName" AS name,
           d."title" AS designation, o."code" AS "orgCode",
           r."name" AS role, u."isActive"
    FROM "public"."User" u
    JOIN "public"."Role" r ON r."id" = u."roleId"
    LEFT JOIN "public"."Employee" e ON e."id" = u."employeeId"
    LEFT JOIN "public"."Designation" d ON d."id" = e."designationId"
    LEFT JOIN "public"."Organization" o ON o."id" = e."organizationId"
    WHERE u."isActive" = true
      AND (u."email" ILIKE ${like} OR (e."firstName" || ' ' || e."lastName") ILIKE ${like})
    ORDER BY name NULLS LAST
    LIMIT ${limit}
  `;
  return rows.map(toAccount);
}

/** The People account behind each email, if any — to show who can actually sign in. */
export async function peopleAccountsByEmail(emails: string[]): Promise<Map<string, PeopleAccount>> {
  if (emails.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT lower(u."email") AS email,
           e."firstName" || ' ' || e."lastName" AS name,
           d."title" AS designation, o."code" AS "orgCode",
           r."name" AS role, u."isActive"
    FROM "public"."User" u
    JOIN "public"."Role" r ON r."id" = u."roleId"
    LEFT JOIN "public"."Employee" e ON e."id" = u."employeeId"
    LEFT JOIN "public"."Designation" d ON d."id" = e."designationId"
    LEFT JOIN "public"."Organization" o ON o."id" = e."organizationId"
    WHERE lower(u."email") = ANY(${emails.map((e) => e.toLowerCase())}::text[])
  `;
  return new Map(rows.map((r) => [r.email, toAccount(r)]));
}
