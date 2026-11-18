/**
 * Ajina (HR, Haris & Co. Academy) currently uses the shared `role_hr`,
 * which has no organization pin (ALL). In People she only belongs to HACA.
 * Creates (or reuses) an "HR – HACA" role — same permissions as HR, pinned
 * to HACA — and moves her onto it. Other HR users on role_hr are untouched.
 *
 *   npx tsx prisma/fix-ajina-role.ts            # dry run
 *   npx tsx prisma/fix-ajina-role.ts --apply
 */
import { reviewClient } from "./_people";

const APPLY = process.argv.includes("--apply");
const db = reviewClient();

async function main() {
  console.log(APPLY ? "APPLY\n" : "DRY RUN\n");
  const hr = await db.reviewRole.findUniqueOrThrow({ where: { id: "role_hr" } });
  const haca = await db.organization.findFirstOrThrow({ where: { code: "HACA" } });
  const ajina = await db.user.findFirstOrThrow({ where: { email: "ajina@harisandcoacademy.com" } });

  let scoped = await db.reviewRole.findFirst({ where: { name: "HR – HACA" } });
  if (!scoped) {
    console.log(`  + create role "HR – HACA" (permissions of HR, pinned to ${haca.code})`);
    if (APPLY) {
      scoped = await db.reviewRole.create({
        data: { name: "HR – HACA", description: "HR, limited to Haris & Co. Academy", baseRole: hr.baseRole, permissions: hr.permissions, homeOrganizationId: haca.id, isSystem: false, isSuperAdmin: false },
      });
    }
  } else {
    console.log(`  = role "HR – HACA" already exists (${scoped.id})`);
  }

  console.log(`  ~ move ${ajina.name} <${ajina.email}> from role_hr to "HR – HACA"`);
  if (APPLY) {
    await db.user.update({ where: { id: ajina.id }, data: { reviewRoleId: scoped!.id } });
  }
  console.log(APPLY ? "\nDone." : "\nNothing was written. Re-run with --apply.");
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
