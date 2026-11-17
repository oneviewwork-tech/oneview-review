/**
 * Brings Review's people in line with ONEVIEW People (HACA and Haris & Co.):
 * active in People = active here, new people appear, everyone else inactive.
 * See src/services/people/sync.ts for exactly what it does and never does.
 *
 * Dry run by default.
 *   npx tsx prisma/sync-people.ts
 *   npx tsx prisma/sync-people.ts --apply
 */
import { prisma } from "../src/lib/prisma";
import { runPeopleSync } from "../src/services/people/sync";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const r = await runPeopleSync({ apply: APPLY, actor: null });
  const list = (title: string, items: string[], n = 40) => {
    console.log(`\n${title}: ${items.length}`);
    items.slice(0, n).forEach((x) => console.log("   - " + x));
    if (items.length > n) console.log(`   … and ${items.length - n} more`);
  };
  console.log(`New people ${r.created} · reactivated ${r.activated} · deactivated ${r.deactivated} · details updated ${r.updated} · new departments ${r.newDepartments}`);
  list("NEW PEOPLE ADDED", r.plan.create.map((c) => `${c.person.name} — ${c.person.orgCode} · ${c.person.department ?? "Unassigned"}`));
  list("REACTIVATED (active in People)", r.who.activated);
  list("DEACTIVATED", r.plan.deactivate.map((d) => `${d.name} — ${d.why}`));
  list("NEW DEPARTMENTS", r.plan.newDepartments.map((d) => `${d.orgCode} · ${d.name}`));
  const linked = r.plan.update.filter((u) => u.what.includes("linked to People")).length;
  console.log(`\nLinking to People ids: ${linked}`);
  list("SKIPPED", r.skipped);
  if (!APPLY) console.log("\nNothing was written. Re-run with --apply.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
