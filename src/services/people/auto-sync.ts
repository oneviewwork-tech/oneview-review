import "server-only";
import { prisma } from "@/lib/prisma";
import { runPeopleSync } from "@/services/people/sync";

/** How stale Review's copy of People may get while the app is in use. */
const EVERY_MS = 10 * 60 * 1000;

let running: Promise<void> | null = null;

/**
 * Keeps Review's employees in step with ONEVIEW People without anyone
 * pressing a button: called after pages render (via `after()`), it runs the
 * People sync when the last run is older than ten minutes. The nightly cron
 * still covers days nobody opens the app.
 *
 * The last run is read from the audit log (every run writes PEOPLE_SYNCED),
 * so the throttle holds across serverless instances. Failures are swallowed:
 * a sync problem must never break a page.
 */
export function syncPeopleIfStale(): Promise<void> {
  running ??= (async () => {
    try {
      const last = await prisma.auditEvent.findFirst({
        where: { entityType: "PeopleSync", action: "PEOPLE_SYNCED" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (last && Date.now() - last.createdAt.getTime() < EVERY_MS) return;
      await runPeopleSync({ apply: true, actor: null });
    } catch (e) {
      console.error("[people-sync] background run failed", e);
    } finally {
      running = null;
    }
  })();
  return running;
}
