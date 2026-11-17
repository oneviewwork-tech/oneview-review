/**
 * The test-only account switcher: sign in as any account with one click,
 * no password. It exists to test role-by-role behaviour against the local
 * test database, and is off unless all three hold:
 *
 *   - not a production build;
 *   - ACCOUNT_SWITCHER=on (set only in .env.local);
 *   - the database is on this machine (localhost / 127.0.0.1).
 *
 * So it can't be switched on against People's live database by accident,
 * and a deployed build never has it.
 */
export function accountSwitcherEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ACCOUNT_SWITCHER !== "on") return false;
  return /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");
}
