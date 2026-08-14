import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

// Edge-safe base config — no Prisma import here (proxy/middleware runs on
// the Edge runtime). The Credentials provider needs Prisma + bcrypt, both
// Node-only, so it's layered on top of this in auth.ts.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
    updateAge: 30 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.departmentId = user.departmentId ?? null;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.sub!;
      session.user.role = token.role as UserRole;
      session.user.departmentId = (token.departmentId as string | null) ?? null;
      session.user.mustChangePassword = token.mustChangePassword as boolean;
      return session;
    },
  },
};
