import { describe, expect, it } from "vitest";
import { mayGrant, ungrantable } from "@/domain/roles";

const admin = { isSuperAdmin: true, permissions: new Set<never>(), organizationId: null };
const hr = { isSuperAdmin: false, permissions: new Set(["PERF_VIEW_ALL", "USERS_MANAGE", "FEEDBACK_REVIEW"] as const), organizationId: null };
const hrHaca = { ...hr, organizationId: "org_haca" };

const role = (permissions: string[], homeOrganizationId: string | null = null, isSuperAdmin = false) =>
  ({ permissions, homeOrganizationId, isSuperAdmin }) as Parameters<typeof mayGrant>[1];

describe("mayGrant", () => {
  it("lets an Admin hand out anything, including Admin", () => {
    expect(mayGrant(admin, role([], null, true))).toBe(true);
    expect(mayGrant(admin, role(["ROLES_MANAGE"]))).toBe(true);
  });

  it("never lets anyone else hand out the Admin role", () => {
    expect(mayGrant(hr, role([], null, true))).toBe(false);
  });

  it("allows only roles within the actor's own permissions", () => {
    expect(mayGrant(hr, role(["PERF_VIEW_ALL", "FEEDBACK_REVIEW"]))).toBe(true);
    expect(mayGrant(hr, role(["PERF_VIEW_ALL", "ROLES_MANAGE"]))).toBe(false);
  });

  it("keeps an organization-pinned actor inside their organization", () => {
    expect(mayGrant(hrHaca, role(["PERF_VIEW_ALL"], "org_haca"))).toBe(true);
    expect(mayGrant(hrHaca, role(["PERF_VIEW_ALL"], "org_harisco"))).toBe(false);
    expect(mayGrant(hrHaca, role(["PERF_VIEW_ALL"], null))).toBe(false);
  });
});

it("ungrantable lists exactly what the actor lacks", () => {
  expect(ungrantable(hr, ["PERF_VIEW_ALL", "ROLES_MANAGE", "PERF_SETUP"])).toEqual(["ROLES_MANAGE", "PERF_SETUP"]);
  expect(ungrantable(admin, ["ROLES_MANAGE"])).toEqual([]);
});
