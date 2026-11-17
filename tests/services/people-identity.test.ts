import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { initialReviewRole, PEOPLE_MANAGED } from "@/services/people/identity";

describe("initialReviewRole", () => {
  it("maps People's Super Admin to Admin, even if also staff-tier", () => {
    expect(initialReviewRole({ isSuperAdmin: true, isStaffTier: true })).toBe("ADMIN");
  });

  it("maps staff-tier roles (HR Admin, org admins) to HR", () => {
    expect(initialReviewRole({ isSuperAdmin: false, isStaffTier: true })).toBe("HR");
  });

  it("gives everyone else the Employee role, with no Review access beyond their own scorecard", () => {
    expect(initialReviewRole({ isSuperAdmin: false, isStaffTier: false })).toBe("EMPLOYEE");
  });
});

describe("PEOPLE_MANAGED placeholder", () => {
  it("can never be satisfied by any password, so a Review row alone cannot sign anyone in", async () => {
    expect(await bcrypt.compare("anything", PEOPLE_MANAGED)).toBe(false);
    expect(await bcrypt.compare(PEOPLE_MANAGED, PEOPLE_MANAGED)).toBe(false);
  });
});
