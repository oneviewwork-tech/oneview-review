"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { validateSettings, type GradeSettings } from "@/domain/performance/grading";
import { requirePermission } from "@/lib/rbac";
import { getGradeSettings } from "@/services/performance/settings";

/** HR/Admin: change the grade and health cut-offs. Validated on the server; the form is not the check. */
export async function saveGradeSettings(input: GradeSettings): Promise<ActionResult> {
  const { user } = await requirePermission("PERF_GRADE_SETTINGS");
  const next: GradeSettings = {
    gradeA: Number(input.gradeA),
    gradeB: Number(input.gradeB),
    healthHigh: Number(input.healthHigh),
    healthStable: Number(input.healthStable),
    healthImproving: Number(input.healthImproving),
  };
  const problem = validateSettings(next);
  if (problem) return fail(problem);

  const before = await getGradeSettings();
  await prisma.$transaction(async (tx) => {
    await tx.perfSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...next, updatedByName: user.name },
      update: { ...next, updatedByName: user.name },
    });
    await writeAuditEvent(tx, {
      entityType: "PerfSettings",
      entityId: "singleton",
      action: "PERF_SETTINGS_SAVED",
      actorUserId: user.id,
      actorEmail: user.email,
      before,
      after: next,
    });
  });
  revalidatePath("/performance", "layout");
  return ok(undefined, "Grade and health cut-offs saved.");
}
