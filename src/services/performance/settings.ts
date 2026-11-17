import { prisma } from "@/lib/prisma";
import { DEFAULT_GRADE_SETTINGS, type GradeSettings } from "@/domain/performance/grading";

/** The grade and health cut-offs HR has set, or the sheet's defaults until they have. */
export async function getGradeSettings(): Promise<GradeSettings> {
  const row = await prisma.perfSettings.findUnique({ where: { id: "singleton" } });
  return row
    ? {
        gradeA: row.gradeA,
        gradeB: row.gradeB,
        healthHigh: row.healthHigh,
        healthStable: row.healthStable,
        healthImproving: row.healthImproving,
      }
    : DEFAULT_GRADE_SETTINGS;
}
