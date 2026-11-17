import { signOut } from "@/lib/auth";

/**
 * Where a session goes when its account no longer exists or has been
 * switched off (see requireUser): clears the session cookie and sends them
 * to sign in. A plain redirect to /login would loop, because the proxy sends
 * anyone with a session cookie from /login back to their home page.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
