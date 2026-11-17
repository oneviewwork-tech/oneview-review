"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { searchPeopleAccounts, type PeopleAccount } from "@/services/people/directory";

/**
 * Backs the "Add from People" picker. Returns only People accounts that
 * don't already have a Review user, so the list is exactly who can still be
 * added. Restricted to HR/Admin like the screen it serves.
 */
export async function searchPeople(query: string): Promise<PeopleAccount[]> {
  await requirePermission("USERS_MANAGE");
  const q = query.trim();
  if (q.length < 2) return [];

  const [found, existing] = await Promise.all([
    searchPeopleAccounts(q),
    prisma.user.findMany({ select: { email: true } }),
  ]);
  const have = new Set(existing.map((u) => u.email.toLowerCase()));
  return found.filter((a) => !have.has(a.email)).slice(0, 10);
}
