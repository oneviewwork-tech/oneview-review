import { reviewClient } from "./_people";
const APPLY = process.argv.includes("--apply");
const db = reviewClient();
const names = ["Web – Junior UI/UX Designer","Web – Junior Web Developer","Web – Content Writer","Web – Junior Full Stack Developer","Web – Junior QA/QC Tester","Web – Senior UI/UX Designer","Web – Senior Shopify Developer"];
async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  for (const name of names) {
    const t = await db.perfTemplate.findFirst({ where: { name }, include: { versions: true } });
    if (!t || t.versions.length !== 1) { console.log(`  ! ${name}: expected 1 version, found ${t?.versions.length}`); continue; }
    const v = t.versions[0];
    const target = new Date(Date.UTC(2026, 7, 1));
    if (+v.effectiveFrom <= +target) { console.log(`  = ${name}: already ${v.effectiveFrom.toISOString().slice(0,7)}`); continue; }
    console.log(`  ~ ${name}: ${v.effectiveFrom.toISOString().slice(0,7)} -> 2026-08`);
    if (APPLY) await db.perfTemplateVersion.update({ where: { id: v.id }, data: { effectiveFrom: target } });
  }
  console.log(APPLY ? "\nDone." : "\nNothing written.");
}
main().finally(() => db.$disconnect());
