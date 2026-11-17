/**
 * Shared by the one-off scripts that read ONEVIEW People.
 *
 * Read-only on People: only SELECTs against its `public` tables. Every write
 * the scripts make goes to the `review` schema, and `reviewClient()` refuses
 * to hand out a client unless the connection is pinned to that schema.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { matchByName } from "../src/domain/people/match";

export function reviewClient(): PrismaClient {
  const text = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  const m = /^DIRECT_URL=(?:"([^"]*)"|(.*))$/m.exec(text);
  const url = m?.[1] ?? m?.[2];
  if (!url) throw new Error("No DIRECT_URL in .env.");
  if (new URL(url).searchParams.get("schema") !== "review") {
    throw new Error("Refusing to run: DIRECT_URL must carry ?schema=review so People's tables cannot be touched.");
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export interface PeopleEmp {
  id: string;
  name: string;
  officialEmail: string;
  loginEmail: string | null;
  loginActive: boolean;
  active: boolean;
  orgCode: string;
  department: string | null;
  departmentCode: string | null;
  designation: string | null;
  manager: string | null;
}

export async function loadPeople(db: PrismaClient): Promise<PeopleEmp[]> {
  const rows = await db.$queryRaw<
    {
      id: string;
      firstName: string;
      lastName: string;
      officialEmail: string;
      status: string;
      archivedAt: Date | null;
      orgCode: string;
      department: string | null;
      departmentCode: string | null;
      designation: string | null;
      mgrFirst: string | null;
      mgrLast: string | null;
      loginEmail: string | null;
      loginActive: boolean | null;
    }[]
  >`
    SELECT e."id", e."firstName", e."lastName", lower(e."officialEmail") AS "officialEmail",
           e."employmentStatus"::text AS "status", e."archivedAt", o."code" AS "orgCode",
           dep."name" AS "department", dep."code" AS "departmentCode", d."title" AS "designation",
           m."firstName" AS "mgrFirst", m."lastName" AS "mgrLast",
           lower(u."email") AS "loginEmail", u."isActive" AS "loginActive"
    FROM "public"."Employee" e
    JOIN "public"."Organization" o ON o."id" = e."organizationId"
    LEFT JOIN "public"."Department" dep ON dep."id" = e."departmentId"
    LEFT JOIN "public"."Designation" d ON d."id" = e."designationId"
    LEFT JOIN "public"."Employee" m ON m."id" = e."reportingManagerId"
    LEFT JOIN "public"."User" u ON u."employeeId" = e."id"
  `;
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    officialEmail: r.officialEmail,
    loginEmail: r.loginEmail,
    loginActive: !!r.loginActive,
    active: r.status === "ACTIVE" && !r.archivedAt,
    orgCode: r.orgCode,
    department: r.department,
    departmentCode: r.departmentCode,
    designation: r.designation,
    manager: r.mgrFirst ? `${r.mgrFirst} ${r.mgrLast ?? ""}`.trim() : null,
  }));
}

export type How = "email" | "name" | "partial";
export interface Match {
  how: How;
  person: PeopleEmp;
}
export type Outcome = { kind: "matched"; match: Match } | { kind: "ambiguous"; names: string[] } | { kind: "none" };

/**
 * Finds one person in `pool`: by email first (their work or login address),
 * then by name. Only a single fitting person is ever returned; a partial
 * name match is flagged so the caller can decide whether to trust it.
 */
export function find(name: string, email: string, pool: PeopleEmp[]): Outcome {
  const lower = email.toLowerCase();
  const byEmail = pool.find((p) => p.officialEmail === lower || p.loginEmail === lower);
  if (byEmail) return { kind: "matched", match: { how: "email", person: byEmail } };

  const r = matchByName(name, pool);
  if (r.kind === "exact") return { kind: "matched", match: { how: "name", person: r.match } };
  if (r.kind === "partial") return { kind: "matched", match: { how: "partial", person: r.match } };
  if (r.kind === "ambiguous") return { kind: "ambiguous", names: r.matches.map((m) => `${m.name} <${m.loginEmail ?? m.officialEmail}>`) };
  return { kind: "none" };
}
