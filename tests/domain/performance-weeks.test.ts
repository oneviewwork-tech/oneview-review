import { describe, expect, it } from "vitest";
import { missedWeeks, todayInIndia, weekLockReason, weekRange, weeksOf } from "@/domain/performance/weeks";

const oct = new Date(Date.UTC(2026, 9, 1)); // 1 Oct 2026 is a Thursday
const nov = new Date(Date.UTC(2026, 10, 1)); // 1 Nov 2026 is a Sunday

describe("weeksOf", () => {
  it("has one Mon–Sat week per Monday in the month", () => {
    expect(weeksOf(oct).map((w) => [w.start, w.end])).toEqual([
      ["2026-10-05", "2026-10-10"],
      ["2026-10-12", "2026-10-17"],
      ["2026-10-19", "2026-10-24"],
      ["2026-10-26", "2026-10-31"],
    ]);
    expect(weeksOf(nov)).toHaveLength(5);
    expect(weeksOf(nov)[0].start).toBe("2026-11-02");
    expect(weeksOf(nov)[4].end).toBe("2026-12-05"); // last week runs into December
  });
  it("labels a range", () => {
    expect(weekRange(weeksOf(oct)[0])).toBe("5–10 Oct");
    expect(weekRange(weeksOf(nov)[4])).toBe("30 Nov–5 Dec");
  });
});

describe("weekLockReason", () => {
  it("never restricts by day: week 1 is always open", () => {
    expect(weekLockReason(oct, 1, [])).toBeNull();
  });
  it("keeps week 2 shut until week 1 is scored", () => {
    expect(weekLockReason(oct, 2, [])).toBe("Score week 1 first.");
    expect(weekLockReason(oct, 2, [1])).toBeNull();
    expect(weekLockReason(oct, 3, [1])).toBe("Score week 2 first.");
  });
  it("leaves a scored week open for corrections", () => {
    expect(weekLockReason(oct, 2, [2])).toBeNull();
  });
  it("rejects a week the month doesn't have", () => {
    expect(weekLockReason(oct, 5, [1, 2, 3, 4])).toMatch(/4 weeks/);
  });
});

describe("missedWeeks", () => {
  it("flags a week from the Monday after its Saturday", () => {
    expect(missedWeeks(oct, [], "2026-10-10")).toEqual([]); // scoring day itself
    expect(missedWeeks(oct, [], "2026-10-11")).toEqual([]); // Sunday off
    expect(missedWeeks(oct, [], "2026-10-12")).toEqual([1]);
    expect(missedWeeks(oct, [1], "2026-10-12")).toEqual([]);
    expect(missedWeeks(oct, [1], "2026-11-02")).toEqual([2, 3, 4]);
  });
});

it("todayInIndia rolls over at Indian midnight", () => {
  expect(todayInIndia(new Date("2026-10-11T18:29:00Z"))).toBe("2026-10-11");
  expect(todayInIndia(new Date("2026-10-11T18:31:00Z"))).toBe("2026-10-12");
});
