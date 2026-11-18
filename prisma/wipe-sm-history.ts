/**
 * Deletes the 62 PerfReview rows seed-sm-history.ts wrote before it also
 * wrote PerfScore rows (a bug: the dashboard's "scored" counts read
 * PerfScore, so these months looked unscored despite having a confirmed
 * total). Safe to re-run: only rows tagged "Imported from SM sheet".
 *
 *   npx tsx prisma/wipe-sm-history.ts            # dry run
 *   npx tsx prisma/wipe-sm-history.ts --apply
 */
import { reviewClient } from "./_people";
const APPLY = process.argv.includes("--apply");
const db = reviewClient();
async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const reviews = await db.perfReview.findMany({ where: { submittedByName: "Imported from SM sheet" }, select: { id: true } });
  console.log(`  ${reviews.length} PerfReview rows to delete`);
  if (APPLY) await db.perfReview.deleteMany({ where: { id: { in: reviews.map((r) => r.id) } } });
  console.log(APPLY ? "\nDone." : "\nNothing written. Re-run with --apply.");
}
main().finally(() => db.$disconnect());
