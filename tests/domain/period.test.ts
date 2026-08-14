import { describe, it, expect } from "vitest";
import { reviewPeriodForDate, monthNameForPeriod, yearForPeriod, formatReviewPeriod } from "@/domain/review/period";

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
