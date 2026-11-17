import { AuthError } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { signIn } from "@/lib/auth";
import { verifySsoTicket } from "@/lib/sso-token";

// Always live: it signs someone in.
export const dynamic = "force-dynamic";

/** Only a path inside Review, never another site (no open redirect). */
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/performance");

/**
 * Landing point for "Performance" in ONEVIEW People. People sends the person
 * here with a one-minute signed ticket; if it checks out they are signed in
 * and taken straight to Performance. Anything wrong goes to the normal login
 * with a short explanation, never an error page.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?sso=${reason}`, req.nextUrl));

  // A quick check first, only to tell the person *why*; the provider re-checks everything.
  const check = verifySsoTicket(token, process.env.REVIEW_SSO_SECRET ?? "");
  if (!check.ok) return fail(check.reason);

  try {
    // Throws Next's redirect on success, which must propagate.
    await signIn("people-sso", { token, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) return fail("inactive");
    throw error;
  }
  return fail("invalid");
}
