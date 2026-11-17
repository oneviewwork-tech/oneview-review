"use server";

import { signIn, signOut } from "@/lib/auth";
import { accountSwitcherEnabled } from "@/lib/account-switcher";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Test-only: become another account without a password. See account-switcher.ts. */
export async function switchAccountAction(email: string) {
  if (!accountSwitcherEnabled()) throw new Error("The account switcher is off.");
  await signIn("account-switcher", { email, redirectTo: "/" });
}
