import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaKeepAliveInterval: NodeJS.Timeout | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Neon's serverless compute auto-suspends after ~5 minutes idle — a
// lightweight periodic ping keeps it warm for the lifetime of this Node
// process. Meaningless on Vercel (no persistent event loop between
// invocations there), so skipped when VERCEL is set.
if (!process.env.VERCEL && !globalForPrisma.prismaKeepAliveInterval) {
  const interval = setInterval(() => {
    prisma.$queryRaw`SELECT 1`.catch(() => {});
  }, 4 * 60 * 1000);
  interval.unref();
  globalForPrisma.prismaKeepAliveInterval = interval;
}
