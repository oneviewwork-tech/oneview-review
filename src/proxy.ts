import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { homePathForRole } from "@/lib/roles";
import type { UserRole } from "@prisma/client";

// Edge-safe NextAuth instance — decodes the JWT cookie only, no
// Prisma/bcrypt (Credentials provider lives in auth.ts, Node-only).
const { auth } = NextAuth(authConfig);

// Backend enforcement of §6/§8/§26's role boundaries at the routing layer.
// Real security still lives in requireDepartmentHead()/requireHr()/
// requireAdmin() (src/lib/rbac.ts) — this just turns "wrong role" into a
// redirect to that role's own home instead of a thrown error page.
const ROLE_PREFIXES: { prefix: string; role: UserRole }[] = [
  { prefix: "/review", role: "DEPARTMENT_HEAD" },
  { prefix: "/my-submissions", role: "DEPARTMENT_HEAD" },
  { prefix: "/overview", role: "HR" },
  { prefix: "/submissions", role: "HR" },
  { prefix: "/email-history", role: "HR" },
  { prefix: "/admin", role: "ADMIN" },
];

/**
 * CSP has to be built per-request rather than set statically in
 * next.config.ts: Next streams the App Router payload as inline <script>
 * tags, so a static `script-src 'self'` blocks its own hydration and every
 * page renders permanently unhydrated. The per-request nonce is read by
 * Next and stamped onto the scripts it emits; 'strict-dynamic' then lets
 * those bootstrap scripts pull their chunks without allowlisting each URL.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind and React inline style attributes need this; there is no
    // nonce mechanism for style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  if (!isLoggedIn) {
    if (pathname !== "/login") {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return withSecurityHeaders(req);
  }

  const role = req.auth!.user.role;
  const home = homePathForRole(role);

  // A forced password reset outranks everything else: hold the user on
  // /change-password until it's done, so a seeded/admin-issued temporary
  // password can't be left in place indefinitely.
  if (req.auth!.user.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.nextUrl));
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  const match = ROLE_PREFIXES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (match && match.role !== role) {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  return withSecurityHeaders(req);
});

function withSecurityHeaders(req: Parameters<Parameters<typeof auth>[0]>[0]) {
  // Dev is left alone: Turbopack's HMR client needs 'unsafe-eval', and a
  // strict policy buys nothing on localhost.
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Set on the request so Next can read the nonce and apply it to the
  // scripts it renders, and on the response so the browser enforces it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/change-password",
    "/review",
    "/review/:path*",
    "/my-submissions",
    "/my-submissions/:path*",
    "/overview",
    "/overview/:path*",
    "/submissions",
    "/submissions/:path*",
    "/email-history",
    "/email-history/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
