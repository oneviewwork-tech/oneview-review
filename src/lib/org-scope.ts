import "server-only";
import { cookies } from "next/headers";

/**
 * The organization picked in the sidebar switcher. Kept in a cookie so the
 * choice holds on every page until it is changed (a URL parameter was lost on
 * each navigation). Only a preference: access is still decided per request.
 */
export const ORG_SCOPE_COOKIE = "review_org";

export async function getSelectedOrgId(): Promise<string | null> {
  const v = (await cookies()).get(ORG_SCOPE_COOKIE)?.value;
  return v && v !== "all" ? v : null;
}
