import { describe, it, expect } from "vitest";
import { planSync, type PeopleRow, type ReviewDepartment, type ReviewPerson } from "@/domain/people/sync-plan";

const person = (id: string, name: string, over: Partial<PeopleRow> = {}): PeopleRow => ({
  id,
  name,
  officialEmail: `${id}@co.com`,
  loginEmail: null,
  orgCode: "HACA",
  department: "Academics",
  departmentCode: "ACAD",
  designation: null,
  manager: null,
  active: true,
  ...over,
});
const emp = (id: string, name: string, over: Partial<ReviewPerson> = {}): ReviewPerson => ({
  id,
  name,
  email: `${id}@co.com`,
  peopleEmail: null,
  peopleEmployeeId: null,
  orgCode: "HACA",
  departmentName: "Academics",
  designation: null,
  reportingManagerName: null,
  isActive: true,
  ...over,
});
const depts: ReviewDepartment[] = [{ id: "d1", name: "Academics", code: "ACAD", orgCode: "HACA" }];
const run = (people: PeopleRow[], review: ReviewPerson[], d = depts) => planSync({ people, review, departments: d, scope: ["HACA", "HARISCO"] });

describe("matching", () => {
  it("links by email and fills in the People id", () => {
    const plan = run([person("a", "Neha Prakash")], [emp("a", "Neha")]);
    expect(plan.update[0].data.peopleEmployeeId).toBe("a");
    expect(plan.create).toHaveLength(0);
    expect(plan.deactivate).toHaveLength(0);
  });

  it("follows an existing link even when the email has changed", () => {
    const plan = run([person("p1", "Neha", { officialEmail: "new@co.com" })], [emp("r1", "Neha", { email: "old@co.com", peopleEmployeeId: "p1" })]);
    expect(plan.create).toHaveLength(0);
    expect(plan.deactivate).toHaveLength(0);
  });

  it("matches the People login email too", () => {
    const plan = run([person("p1", "Alen Krishnan", { officialEmail: "alen@co.com", loginEmail: "alen.k@co.com" })], [emp("r1", "Alen", { email: "alen.k@co.com" })]);
    expect(plan.create).toHaveLength(0);
  });

  it("falls back to an exact, unique name within the organization", () => {
    const plan = run([person("p1", "Anju Shaji", { officialEmail: "x@co.com" })], [emp("r1", "Anju Shaji", { email: "anju@gmail.com" })]);
    expect(plan.update[0].data.peopleEmployeeId).toBe("p1");
    expect(plan.create).toHaveLength(0);
  });

  it("never links on a partial name, nor when two people share a name", () => {
    const partial = run([person("p1", "Neha Prakash", { officialEmail: "x@co.com" })], [emp("r1", "Neha", { email: "n@gmail.com" })]);
    expect(partial.update).toHaveLength(0);
    expect(partial.create).toHaveLength(1); // treated as new rather than guessed
    const dupes = run(
      [person("p1", "Sam", { officialEmail: "a@co.com" }), person("p2", "Sam", { officialEmail: "b@co.com" })],
      [emp("r1", "Sam", { email: "s@gmail.com" })]
    );
    expect(dupes.update).toHaveLength(0);
  });

  it("does not match across organizations", () => {
    const plan = run([person("p1", "Sam", { orgCode: "HARISCO", officialEmail: "s-h@co.com" })], [emp("r1", "Sam", { email: "s@co.com", orgCode: "HACA" })]);
    expect(plan.create).toHaveLength(1);
    expect(plan.deactivate).toHaveLength(1);
  });
});

describe("active status follows People", () => {
  it("activates someone inactive in Review who is active in People", () => {
    const plan = run([person("a", "A")], [emp("a", "A", { isActive: false })]);
    expect(plan.activate).toEqual(["a"]);
    expect(plan.update[0].data.isActive).toBe(true);
  });

  it("deactivates someone active in Review who is inactive in People", () => {
    const plan = run([person("a", "A", { active: false })], [emp("a", "A")]);
    expect(plan.deactivate.map((d) => d.id)).toEqual(["a"]);
  });

  it("deactivates people who are not in People at all", () => {
    const plan = run([], [emp("z", "Ghost")]);
    expect(plan.deactivate).toEqual([{ id: "z", name: "Ghost", why: "not in ONEVIEW People" }]);
  });

  it("leaves someone already inactive and gone from People alone", () => {
    expect(run([], [emp("z", "Ghost", { isActive: false })]).deactivate).toHaveLength(0);
  });
});

describe("new people", () => {
  it("adds an active person People has and Review doesn't, into the matching department", () => {
    const plan = run([person("n", "New Joiner")], []);
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].departmentKey).toBe("HACA|academics");
    expect(plan.newDepartments).toHaveLength(0);
  });

  it("creates the department when Review has none by that name", () => {
    const plan = run([person("n", "N", { department: "Sales", departmentCode: "SALES" })], []);
    expect(plan.newDepartments).toEqual([{ key: "HACA|sales", orgCode: "HACA", name: "Sales", code: "SALES" }]);
  });

  it("treats department names that mean the same as one department", () => {
    const d: ReviewDepartment[] = [{ id: "w", name: "Web", code: "WEB", orgCode: "HARISCO" }];
    const plan = run([person("n", "N", { orgCode: "HARISCO", department: "Web Development", departmentCode: "WD" })], [], d);
    expect(plan.newDepartments).toHaveLength(0);
    expect(plan.create[0].departmentKey).toBe("HARISCO|web");
  });

  it("does not add inactive people", () => {
    expect(run([person("n", "N", { active: false })], []).create).toHaveLength(0);
  });

  it("holds someone with no department in Unassigned, so every active person is in Review", () => {
    const plan = run([person("n", "N", { department: null })], []);
    expect(plan.create).toHaveLength(1);
    expect(plan.newDepartments).toEqual([expect.objectContaining({ name: "Unassigned", code: "UNASSIGNED" })]);
  });

  it("moves someone out of Unassigned once People gives them a department", () => {
    const plan = run(
      [person("n", "N")],
      [emp("n", "N", { peopleEmployeeId: "n", departmentName: "Unassigned" })],
      [...depts, { id: "u", name: "Unassigned", code: "UNASSIGNED", orgCode: "HACA" }]
    );
    expect(plan.update[0].moveToDepartmentKey).toBe("HACA|academics");
  });

  it("never moves someone HR placed in a review department", () => {
    const plan = run([person("n", "N", { department: "Marketing" })], [emp("n", "N", { peopleEmployeeId: "n" })]);
    expect(plan.update).toHaveLength(0);
  });

  it("skips a new person whose email already belongs to someone", () => {
    // r1 is already tied to People id "other"; a different People record "n" shares its email.
    const plan = run(
      [person("other", "Owner", { officialEmail: "owner@co.com" }), person("n", "Newcomer", { officialEmail: "taken@co.com" })],
      [emp("r1", "Taken", { email: "taken@co.com", peopleEmployeeId: "other" })]
    );
    expect(plan.create).toHaveLength(0);
    expect(plan.skipped.length).toBeGreaterThan(0);
  });
});

describe("scope", () => {
  it("ignores organizations outside scope, on both sides", () => {
    const plan = run(
      [person("u", "UAE Person", { orgCode: "HACA_UAE" })],
      [emp("u2", "UAE Review", { orgCode: "HACA_UAE" })]
    );
    expect(plan.create).toHaveLength(0);
    expect(plan.deactivate).toHaveLength(0);
    expect(plan.update).toHaveLength(0);
  });
});

describe("keeping details current", () => {
  it("updates designation and manager, but not name or department", () => {
    const plan = run(
      [person("a", "Full Name", { designation: "Lead", manager: "Boss", department: "Other" })],
      [emp("a", "Short", { peopleEmployeeId: "a", designation: "Old" })]
    );
    expect(plan.update[0].data).toMatchObject({ designation: "Lead", reportingManagerName: "Boss" });
    expect(Object.keys(plan.update[0].data)).not.toContain("name");
  });

  it("changes nothing when everything already agrees", () => {
    expect(run([person("a", "A")], [emp("a", "A", { peopleEmployeeId: "a" })]).update).toHaveLength(0);
  });
});
