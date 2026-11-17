import { describe, it, expect } from "vitest";
import { kpiPoints, partsOf, scoreWeek, scoreMonth, type KpiDef } from "@/domain/performance/engine";

const rating = (id: string, kraId: string, maxPoints: number): KpiDef => ({ id, kraId, maxPoints, mode: "RATING" });

describe("kpiPoints", () => {
  it("clamps a rating to 0..max", () => {
    const k = rating("a", "k", 5);
    expect(kpiPoints(k, 7)).toBe(5);
    expect(kpiPoints(k, -1)).toBe(0);
    expect(kpiPoints(k, 4.5)).toBe(4.5);
  });

  it("returns null when nothing was entered", () => {
    expect(kpiPoints(rating("a", "k", 5), undefined)).toBeNull();
    expect(kpiPoints(rating("a", "k", 5), null)).toBeNull();
  });

  it("scores higher-is-better targets proportionally, capped at the weight", () => {
    const k: KpiDef = { id: "t", kraId: "k", maxPoints: 10, mode: "TARGET", target: 85, direction: "HIGHER_IS_BETTER" };
    expect(kpiPoints(k, 85)).toBe(10);
    expect(kpiPoints(k, 42.5)).toBe(5);
    expect(kpiPoints(k, 99)).toBe(10);
  });

  it("scores lower-is-better targets (e.g. resolution hours)", () => {
    const k: KpiDef = { id: "t", kraId: "k", maxPoints: 10, mode: "TARGET", target: 48, direction: "LOWER_IS_BETTER" };
    expect(kpiPoints(k, 24)).toBe(10);
    expect(kpiPoints(k, 96)).toBe(5);
  });

  it("refuses a TARGET KPI with no target", () => {
    const k: KpiDef = { id: "t", kraId: "k", maxPoints: 10, mode: "TARGET", direction: "HIGHER_IS_BETTER" };
    expect(() => kpiPoints(k, 5)).toThrow();
  });
});

describe("scoreWeek / scoreMonth", () => {
  const kpis = [rating("a", "k1", 5), rating("b", "k1", 5), rating("c", "k2", 10)];

  it("sums points and groups them by KRA", () => {
    const w = scoreWeek(kpis, { a: 5, b: 4, c: 7.5 });
    expect(w.total).toBe(16.5);
    expect(w.maxTotal).toBe(20);
    expect(w.kras).toEqual([
      { kraId: "k1", points: 9, maxPoints: 10 },
      { kraId: "k2", points: 7.5, maxPoints: 10 },
    ]);
  });

  it("averages only the weeks that were scored; a scored zero week counts", () => {
    const m = scoreMonth(kpis, [{ a: 5, b: 5, c: 10 }, { a: 0, b: 0, c: 0 }, {}]);
    expect(m).toMatchObject({ average: 10, base: 10, deduction: 0, weeksScored: 2 });
  });

  it("has no average before anything is scored", () => {
    expect(scoreMonth(kpis, [{}, {}])).toMatchObject({ average: null, base: null, deduction: 0, weeksScored: 0, performance: null, potential: null });
  });

  it("takes critical KPI deductions off the month: 85 with 25 deducted is 60", () => {
    const k: KpiDef[] = [rating("a", "k1", 100)];
    expect(scoreMonth(k, [{ a: 80 }, { a: 90 }], 25)).toMatchObject({ base: 85, deduction: 25, average: 60 });
    expect(scoreMonth(k, [{ a: 10 }], 25).average).toBe(0); // never below zero
    expect(scoreMonth(k, [{}], 25).average).toBeNull(); // nothing scored yet
  });
});

// Real data: Aug 2026 Academic Excellence sheet, Neha (all four weeks identical).
// The sheet states a total of 89.5, which its own rows sum to.
describe("Academic Lead August template (from the HR sheet)", () => {
  const rows: [string, string, number, number][] = [
    // [kpi, kra, weight, awarded]
    ["syllabus", "curriculum", 5, 5],
    ["revision", "curriculum", 5, 5],
    ["calendar", "curriculum", 5, 5],
    ["satisfaction", "teaching", 6, 6],
    ["punctuality", "teaching", 4, 4],
    ["evalTat", "teaching", 3, 3],
    ["mentorPerf", "teaching", 3, 3],
    ["mentorCoord", "teaching", 4, 3],
    ["placement", "success", 7, 1.5],
    ["nps", "success", 8, 4],
    ["portfolio", "success", 5, 5],
    ["dropout", "success", 5, 5],
    ["fbCollect", "feedback", 3, 3],
    ["fbClosure", "feedback", 4, 4],
    ["improve", "feedback", 3, 3],
    ["weeklyMeeting", "governance", 5, 5],
    ["crossDept", "governance", 5, 5],
    ["audit", "governance", 5, 5],
    ["dashboard", "governance", 5, 5],
    ["initiatives", "innovation", 4, 4],
    ["process", "innovation", 3, 3],
    ["faculty", "innovation", 3, 3],
  ];
  const kpis = rows.map(([id, kraId, w]) => rating(id, kraId, w));
  const week = Object.fromEntries(rows.map(([id, , , v]) => [id, v]));

  it("weights add up to 100", () => {
    expect(scoreWeek(kpis, week).maxTotal).toBe(100);
  });

  it("recomputes the sheet's 89.5", () => {
    expect(scoreWeek(kpis, week).total).toBe(89.5);
    expect(scoreMonth(kpis, [week, week, week, week]).average).toBe(89.5);
  });
});

describe("Performance 60 / Potential 40", () => {
  // HR's usual shape: five KRAs of 20 (10 + 5 + 5).
  const card: KpiDef[] = [1, 2, 3, 4, 5].flatMap((n) => [rating(`k${n}a`, `k${n}`, 10), rating(`k${n}b`, `k${n}`, 5), rating(`k${n}c`, `k${n}`, 5)]);

  it("puts the first 60 points in Performance and the rest in Potential", () => {
    const parts = partsOf(card);
    expect(card.filter((k) => parts.get(k.id) === "PERFORMANCE").map((k) => k.kraId)).toEqual(Array(9).fill(0).map((_, i) => `k${Math.floor(i / 3) + 1}`));
    const w = scoreWeek(card, Object.fromEntries(card.map((k) => [k.id, k.maxPoints])));
    expect(w.parts).toEqual({ performance: 60, potential: 40, performanceMax: 60, potentialMax: 40 });
  });

  it("sends a KPI straddling the line to the side most of it is on", () => {
    const k = [rating("x", "a", 55), rating("y", "b", 8), rating("z", "c", 37)];
    const parts = partsOf(k);
    expect([parts.get("x"), parts.get("y"), parts.get("z")]).toEqual(["PERFORMANCE", "PERFORMANCE", "POTENTIAL"]);
  });

  it("averages each part over the scored weeks", () => {
    const full = Object.fromEntries(card.map((k) => [k.id, k.maxPoints]));
    const m = scoreMonth(card, [full, {}, Object.fromEntries(card.map((k) => [k.id, 0]))]);
    expect(m).toMatchObject({ performance: 30, potential: 20, performanceMax: 60, potentialMax: 40, average: 50 });
  });
});
