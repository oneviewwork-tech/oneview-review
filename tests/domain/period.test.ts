import { describe, it, expect } from "vitest";
import {
  reviewPeriodForDate,
  monthNameForPeriod,
  yearForPeriod,
  formatReviewPeriod,
  parseReviewPeriod,
  selectablePeriods,
  formatPeriodValue,
} from "@/domain/review/period";

describe("review period", () => {
  it("normalizes any date to the first of its UTC month", () => {
    const period = reviewPeriodForDate(new Date(Date.UTC(2026, 7, 31, 23, 59)));
    expect(period.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("derives month name and year", () => {
    const period = reviewPeriodForDate(new Date(Date.UTC(2026, 7, 1)));
    expect(monthNameForPeriod(period)).toBe("August");
    expect(yearForPeriod(period)).toBe(2026);
    expect(formatReviewPeriod(period)).toBe("August 2026");
  });
});

describe("choosing a review period", () => {
  const now = new Date(Date.UTC(2026, 8, 1)); // 1 September 2026

  it("accepts the month just gone, which is the common case", () => {
    // Feedback for August is normally written in early September.
    expect(parseReviewPeriod("2026-08", now)?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("accepts the current month", () => {
    expect(parseReviewPeriod("2026-09", now)?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("refuses a month that has not happened yet", () => {
    expect(parseReviewPeriod("2026-10", now)).toBeNull();
  });

  it("refuses malformed input", () => {
    for (const bad of ["", "2026", "2026-13", "26-08", "august"]) {
      expect(parseReviewPeriod(bad, now)).toBeNull();
    }
  });

  it("offers the current month first, then earlier ones", () => {
    const periods = selectablePeriods(3, now);
    expect(periods.map((p) => formatPeriodValue(p))).toEqual(["2026-09", "2026-08", "2026-07"]);
  });
});
