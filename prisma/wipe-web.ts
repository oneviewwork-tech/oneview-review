import { reviewClient } from "./_people";
const APPLY = process.argv.includes("--apply");
const db = reviewClient();
async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const reviews = await db.perfReview.findMany({ where: { submittedByName: "Imported from Web performance report" }, select: { id: true } });
  console.log(`  ${reviews.length} PerfReview rows to delete`);
  if (APPLY) await db.perfReview.deleteMany({ where: { id: { in: reviews.map((r) => r.id) } } });
  console.log(APPLY ? "\nDone." : "\nNothing written.");
}
main().finally(() => db.$disconnect());
