import { describe, it, expect } from "vitest";
import { DEFAULT_GRADE_SETTINGS as D, gradeOf, healthOf, validateSettings } from "@/domain/performance/grading";

describe("gradeOf (sheet defaults: A >= 85, B 70-84, C < 70)", () => {
  it.each([
    [97, "A"],
    [85, "A"],
    [84.9, "B"],
    [70, "B"],
    [69.9, "C"],
    [0, "C"],
  ] as const)("%s -> %s", (p, g) => expect(gradeOf(p, D)).toBe(g));

  it("follows custom cut-offs", () => {
    expect(gradeOf(80, { ...D, gradeA: 80 })).toBe("A");
    expect(gradeOf(80, { ...D, gradeA: 90, gradeB: 81 })).toBe("C");
  });
});

describe("healthOf (80 / 70 / 60)", () => {
  it.each([
    [91.03, "HIGH"],
    [80, "HIGH"],
    [79, "STABLE"],
    [70, "STABLE"],
    [65, "IMPROVING"],
    [60, "IMPROVING"],
    [59.9, "AT_RISK"],
  ] as const)("%s -> %s", (p, h) => expect(healthOf(p, D)).toBe(h));
});

describe("validateSettings", () => {
  it("accepts the defaults", () => expect(validateSettings(D)).toBeNull());

  it("rejects ladders that don't descend", () => {
    expect(validateSettings({ ...D, gradeA: 70, gradeB: 70 })).toMatch(/A cut-off/);
    expect(validateSettings({ ...D, healthStable: 85 })).toMatch(/Health/);
    expect(validateSettings({ ...D, healthImproving: 75 })).toMatch(/Health/);
  });

  it("rejects out-of-range and non-numeric values", () => {
    expect(validateSettings({ ...D, gradeA: 120 })).toMatch(/0 to 100/);
    expect(validateSettings({ ...D, gradeB: -1 })).toMatch(/0 to 100/);
    expect(validateSettings({ ...D, gradeB: NaN })).toMatch(/0 to 100/);
  });
});
