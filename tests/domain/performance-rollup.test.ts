import { describe, it, expect } from "vitest";
import { groupBy, percentOf, scoreGroup, viewerLevel, type RollupRow } from "@/domain/performance/rollup";

const row = (
  employeeId: string,
  average: number | null,
  over: Partial<RollupRow> = {}
): RollupRow => ({
  employeeId,
  average,
  maxTotal: 100,
  organizationName: "HACA",
  departmentName: "Academics",
  scorerUserId: "neha",
  scorerName: "Neha",
  ...over,
});

describe("scoreGroup", () => {
  it("averages the scored people and ignores those not yet scored", () => {
    const g = scoreGroup("t", "Team", [row("a", 90), row("b", 80), row("c", null)]);
    expect(g).toMatchObject({ people: 3, scored: 2, percent: 85 });
  });

  it("has no score when nobody is scored, instead of a misleading zero", () => {
    expect(scoreGroup("t", "Team", [row("a", null)]).percent).toBeNull();
    expect(scoreGroup("t", "Team", []).percent).toBeNull();
  });

  it("compares scorecards with different maximums as shares of their own maximum", () => {
    // 45/50 = 90%, 80/100 = 80%  -> 85%, not (45+80)/2
    const g = scoreGroup("t", "Team", [row("a", 45, { maxTotal: 50 }), row("b", 80)]);
    expect(g.percent).toBe(85);
  });

  it("rounds to one decimal", () => {
    expect(scoreGroup("t", "T", [row("a", 89.55), row("b", 80)]).percent).toBe(84.8);
  });
});

describe("percentOf", () => {
  it("is null for unscored people and for a scorecard with no points", () => {
    expect(percentOf({ average: null, maxTotal: 100 })).toBeNull();
    expect(percentOf({ average: 5, maxTotal: 0 })).toBeNull();
    expect(percentOf({ average: 50, maxTotal: 100 })).toBe(50);
  });
});

describe("groupBy", () => {
  const rows = [
    row("a", 90, { departmentName: "Tech" }),
    row("b", 70, { departmentName: "Tech" }),
    row("c", 95, { departmentName: "Design" }),
    row("d", null, { departmentName: "Sales" }),
  ];

  it("groups, scores each group, and lists the best first with unscored last", () => {
    const g = groupBy(rows, (r) => r.departmentName);
    expect(g.map((x) => [x.label, x.percent])).toEqual([
      ["Design", 95],
      ["Tech", 80],
      ["Sales", null],
    ]);
  });

  it("keeps separate groups that share a name when keyed differently", () => {
    const g = groupBy(
      [row("a", 80, { scorerUserId: "u1", scorerName: "Sam" }), row("b", 60, { scorerUserId: "u2", scorerName: "Sam" })],
      (r) => r.scorerUserId,
      (r) => r.scorerName
    );
    expect(g).toHaveLength(2);
  });
});

describe("viewerLevel", () => {
  it("gives HR and Admin the organization view", () => {
    expect(viewerLevel(true, "x", [row("a", 1)])).toBe("organization");
  });

  it("gives someone who only scores individuals the team view", () => {
    expect(viewerLevel(false, "neha", [row("a", 1), row("b", 1)])).toBe("team");
  });

  it("gives someone whose people are scored by other scorers the department view", () => {
    // Saheel sees his direct reports and Neha's team beneath them.
    expect(viewerLevel(false, "saheel", [row("neha", 1, { scorerUserId: "saheel" }), row("mentor", 1, { scorerUserId: "neha" })])).toBe(
      "department"
    );
  });
});
