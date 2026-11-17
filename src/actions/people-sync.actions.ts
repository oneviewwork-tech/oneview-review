"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { ok, type ActionResult } from "@/lib/action-result";
import { runPeopleSync } from "@/services/people/sync";

/** HR/Admin: sync with ONEVIEW People right now, instead of waiting for the daily run. */
export async function syncPeopleNow(): Promise<ActionResult> {
  const { user } = await requirePermission("EMPLOYEES_MANAGE");
  const r = await runPeopleSync({ apply: true, actor: { id: user.id, email: user.email } });
  revalidatePath("/admin/employees");
  revalidatePath("/performance", "layout");
  revalidatePath("/overview");

  const parts = [
    r.created && `${r.created} new`,
    r.activated && `${r.activated} reactivated`,
    r.deactivated && `${r.deactivated} marked inactive`,
  ].filter(Boolean);
  const tail = r.skipped.length ? ` ${r.skipped.length} couldn't be added (no department in People).` : "";
  return ok(undefined, parts.length ? `Synced with People: ${parts.join(", ")}.${tail}` : `Already up to date with People.${tail}`);
}
