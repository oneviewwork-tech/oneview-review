/**
 * Akash's Design TEAM sheet data (July, September) is scored against the
 * Video Editor KPI structure, not his current "Graphic Designer" scorecard
 * - the same seat Akshay later took over in October. Per the user's "load
 * exactly what's in the sheet" instruction, his assignment moves to Video
 * Editor so seed-sm-history.ts can record it against the matching version.
 *
 *   npx tsx prisma/fix-akash-assignment.ts            # dry run
 *   npx tsx prisma/fix-akash-assignment.ts --apply
 */
import { reviewClient } from "./_people";
const APPLY = process.argv.includes("--apply");
const db = reviewClient();
async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const e = await db.employee.findFirstOrThrow({ where: { email: "akashm@harisand.co" }, select: { id: true, name: true, perfAssignment: { select: { id: true, scorerUserId: true, template: { select: { name: true } } } } } });
  const t = await db.perfTemplate.findFirstOrThrow({ where: { name: "Social Media – Video Editor" }, select: { id: true } });
  console.log(`  ~ ${e.name}: ${e.perfAssignment?.template.name} -> Social Media – Video Editor`);
  if (APPLY) await db.perfAssignment.update({ where: { id: e.perfAssignment!.id }, data: { templateId: t.id } });
  console.log(APPLY ? "\nDone." : "\nNothing written. Re-run with --apply.");
}
main().finally(() => db.$disconnect());
