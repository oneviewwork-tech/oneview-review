/**
 * The Social Media scorecards were all created with a single version dated
 * October 2026 (when seed-sm.ts first set them up), but the KPI structure
 * in the newly-loaded history sheets shows it was unchanged back to April
 * (Managers) / June (Writers, Production, Leads) / July (Design TEAM) - so
 * rather than creating a duplicate version, the existing one is backdated.
 *
 *   npx tsx prisma/fix-sm-versions.ts            # dry run
 *   npx tsx prisma/fix-sm-versions.ts --apply
 */
import { reviewClient } from "./_people";
const APPLY = process.argv.includes("--apply");
const db = reviewClient();

const BACKDATE: [string, Date][] = [
  ["Social Media – Writer", new Date(Date.UTC(2026, 5, 1))],
  ["Social Media – Director of Photography", new Date(Date.UTC(2026, 5, 1))],
  ["Social Media – Social Media Manager", new Date(Date.UTC(2026, 3, 1))], // Parita, via Managers file
  ["Social Media – Production Head", new Date(Date.UTC(2026, 5, 1))], // Fairuza, via Leads file
  ["Social Media – Video Editor", new Date(Date.UTC(2026, 6, 1))], // Akshay, via Design TEAM
];

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  for (const [name, from] of BACKDATE) {
    const t = await db.perfTemplate.findFirst({ where: { name }, include: { versions: true } });
    if (!t) { console.log(`  ! ${name}: not found`); continue; }
    if (t.versions.length !== 1) { console.log(`  ! ${name}: has ${t.versions.length} versions, expected exactly 1; skipped`); continue; }
    const v = t.versions[0];
    if (+v.effectiveFrom <= +from) { console.log(`  = ${name}: already effective from ${v.effectiveFrom.toISOString().slice(0,7)}`); continue; }
    console.log(`  ~ ${name}: ${v.effectiveFrom.toISOString().slice(0,7)} -> ${from.toISOString().slice(0,7)}`);
    if (APPLY) await db.perfTemplateVersion.update({ where: { id: v.id }, data: { effectiveFrom: from } });
  }
  console.log(APPLY ? "\nDone." : "\nNothing written. Re-run with --apply.");
}
main().finally(() => db.$disconnect());
