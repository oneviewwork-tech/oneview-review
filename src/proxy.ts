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

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  if (!isLoggedIn) {
    if (pathname !== "/login") {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const role = req.auth!.user.role;
  const home = homePathForRole(role);

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  const match = ROLE_PREFIXES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (match && match.role !== role) {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/login",
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
