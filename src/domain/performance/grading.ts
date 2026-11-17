/**
 * Turning a score (a percentage of the scorecard maximum) into a grade, and a
 * group's average into a health label. The cut-offs are HR's to set; the
 * defaults are the ones in HR's dashboard sheet.
 */
export interface GradeSettings {
  /** A at or above this. */
  gradeA: number;
  /** B at or above this (and below A); C below it. */
  gradeB: number;
  /** Department health: High Performing at or above this. */
  healthHigh: number;
  /** Stable at or above this (and below High). */
  healthStable: number;
  /** Needs Improvement at or above this (and below Stable); At Risk below it. */
  healthImproving: number;
}

export const DEFAULT_GRADE_SETTINGS: GradeSettings = {
  gradeA: 85,
  gradeB: 70,
  healthHigh: 80,
  healthStable: 70,
  healthImproving: 60,
};

export type Grade = "A" | "B" | "C";
export type Health = "HIGH" | "STABLE" | "IMPROVING" | "AT_RISK";

export const GRADE_LABEL: Record<Grade, string> = { A: "High Performer", B: "Stable Performer", C: "Needs Improvement" };

/** "≥ 85", "70–84", "< 70": how each grade's range is written everywhere. */
export function gradeRange(grade: Grade, s: GradeSettings): string {
  return grade === "A" ? `≥ ${s.gradeA}` : grade === "B" ? `${s.gradeB}–${s.gradeA - 1}` : `< ${s.gradeB}`;
}
export const HEALTH_LABEL: Record<Health, string> = {
  HIGH: "High Performing",
  STABLE: "Stable",
  IMPROVING: "Needs Improvement",
  AT_RISK: "At Risk",
};

export const gradeOf = (percent: number, s: GradeSettings): Grade => (percent >= s.gradeA ? "A" : percent >= s.gradeB ? "B" : "C");

/**
 * What a person is told about their own month: the grade band, never the
 * exact number. 85 with cut-offs 85/70 → "85–100", "High Performer".
 */
export function bandOf(percent: number, s: GradeSettings): { grade: Grade; label: string; range: string } {
  const grade = gradeOf(percent, s);
  return { grade, label: GRADE_LABEL[grade], range: gradeRange(grade, s) };
}

export const healthOf = (percent: number, s: GradeSettings): Health =>
  percent >= s.healthHigh ? "HIGH" : percent >= s.healthStable ? "STABLE" : percent >= s.healthImproving ? "IMPROVING" : "AT_RISK";

/**
 * Checks a proposed set of cut-offs; returns the first problem, or null.
 * Each must be between 0 and 100, and each ladder must strictly descend —
 * otherwise a grade or label could never apply.
 */
export function validateSettings(s: GradeSettings): string | null {
  const all = Object.entries(s);
  for (const [k, v] of all) {
    if (!Number.isFinite(v) || v < 0 || v > 100) return `${k} must be a number from 0 to 100.`;
  }
  if (!(s.gradeA > s.gradeB)) return "The A cut-off must be higher than the B cut-off.";
  if (!(s.healthHigh > s.healthStable && s.healthStable > s.healthImproving)) {
    return "Health cut-offs must go High Performing > Stable > Needs Improvement.";
  }
  return null;
}
