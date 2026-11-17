"use server";

import { cookies } from "next/headers";
import { ORG_SCOPE_COOKIE } from "@/lib/org-scope";
import { getAllScopeOrganizations } from "@/services/review/scope";

/** Sidebar switcher: show one organization everywhere, or all of them. */
export async function setOrgScope(orgId: string): Promise<void> {
  const jar = await cookies();
  // Only an organization this person may see; anything else means "all".
  const allowed = (await getAllScopeOrganizations()).some((o) => o.id === orgId);
  if (!allowed) {
    jar.delete(ORG_SCOPE_COOKIE);
    return;
  }
  jar.set(ORG_SCOPE_COOKIE, orgId, { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
}
