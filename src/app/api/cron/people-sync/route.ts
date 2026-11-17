import { timingSafeEqual } from "node:crypto";
import { runPeopleSync } from "@/services/people/sync";

// Always live: it reads People and writes Review.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means nobody can call this — it must never be open.
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily: follow ONEVIEW People. New joiners appear in Review, people who have
 * left (or were never in People) become inactive, and returners are
 * reactivated. Called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return new Response("Unauthorized", { status: 401 });
  const { plan: _plan, ...summary } = await runPeopleSync({ apply: true, actor: null });
  void _plan;
  return Response.json(summary);
}
