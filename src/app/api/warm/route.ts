import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Wakes the stack up before people start using it.
 *
 * Two things go cold between review cycles: the serverless function (no
 * warm instance to reuse) and the Postgres compute, which suspends when
 * idle. Both are paid for on the first real request, which lands on
 * whoever happens to sign in first.
 *
 * This runs the same shape of query the dashboard opens with — a couple of
 * cheap counts rather than `SELECT 1` — so the connection, the query
 * planner and Prisma's client are all warm by the time a person arrives.
 *
 * Unauthenticated on purpose, so an external uptime pinger can call it, and
 * it returns nothing but timings and a boolean.
 *
 * NOTE ON COST: pinging this every few minutes around the clock keeps the
 * database compute running around the clock, which is metered on Neon's
 * smaller plans. For a system used a few days a month, schedule the pinger
 * for those days rather than leaving it on permanently — see README.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await Promise.all([
      prisma.organization.count(),
      prisma.employee.count({ where: { isActive: true } }),
    ]);
    const ms = Date.now() - startedAt;
    return NextResponse.json(
      { warm: true, ms, timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { warm: false, ms: Date.now() - startedAt, timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
