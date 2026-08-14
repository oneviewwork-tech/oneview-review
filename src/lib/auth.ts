import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { writeAuditEvent } from "@/lib/audit";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        // Same rejection path whether the account doesn't exist, is
        // deactivated, or is locked — never reveals which to the caller.
        if (!user || !user.isActive) {
          await writeAuditEvent(prisma, {
            entityType: "User",
            entityId: email,
            action: "LOGIN_FAILED",
            actorUserId: null,
            actorEmail: email,
            metadata: { reason: user ? "inactive" : "not_found" },
          });
          await bcrypt.compare(password, "$2a$10$invalidsaltinvalidsaltinvalidsaltinva");
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await writeAuditEvent(prisma, {
            entityType: "User",
            entityId: user.id,
            action: "LOGIN_FAILED",
            actorUserId: user.id,
            actorEmail: user.email,
            metadata: { reason: "locked", lockedUntil: user.lockedUntil.toISOString() },
          });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockingNow = attempts >= LOCKOUT_THRESHOLD;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: lockingNow ? new Date(Date.now() + LOCKOUT_DURATION_MS) : user.lockedUntil,
            },
          });
          await writeAuditEvent(prisma, {
            entityType: "User",
            entityId: user.id,
            action: lockingNow ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            actorUserId: user.id,
            actorEmail: user.email,
            metadata: { reason: "wrong_password", attempts },
          });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        await writeAuditEvent(prisma, {
          entityType: "User",
          entityId: user.id,
          action: "LOGIN",
          actorUserId: user.id,
          actorEmail: user.email,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  events: {
    signOut: async (message) => {
      const token = "token" in message ? message.token : null;
      if (!token?.sub) return;
      await writeAuditEvent(prisma, {
        entityType: "User",
        entityId: token.sub,
        action: "LOGOUT",
        actorUserId: token.sub,
        actorEmail: null,
      }).catch(() => {});
    },
  },
});
