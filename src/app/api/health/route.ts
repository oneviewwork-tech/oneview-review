import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liveness + DB reachability probe for uptime monitoring. Deliberately
 * exposes nothing beyond ok/degraded and a timestamp — an unauthenticated
 * endpoint should never leak schema, versions, or connection details.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
