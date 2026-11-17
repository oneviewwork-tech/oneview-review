import { timingSafeEqual } from "node:crypto";
import { periodInPlay } from "@/domain/performance/workflow";
import { runReminders } from "@/services/performance/reminders";

// Always live: it reads the database and sends email.
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means nobody can call this — it must never be open.
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Weekly reminder run, called by Vercel Cron (which sends
 * `Authorization: Bearer $CRON_SECRET`). Emails Team Leads who still owe a
 * submission and reviewers with submissions waiting. Anyone reminded in the
 * last day is skipped, so an accidental double call is harmless.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return new Response("Unauthorized", { status: 401 });
  const result = await runReminders(periodInPlay(new Date()), null);
  return Response.json(result);
}
