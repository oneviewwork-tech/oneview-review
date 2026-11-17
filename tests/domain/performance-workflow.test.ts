import { describe, it, expect } from "vitest";
import {
  canDecide,
  canEditScores,
  canSubmit,
  mayDecide,
  mayViewScores,
  pendingByScorer,
  periodInPlay,
  reviewerOf,
  waitingByReviewer,
  type PendingScoring,
  type ReviewerEdge,
} from "@/domain/performance/workflow";

describe("what each state allows", () => {
  it("only lets the Team Lead edit scores while drafting or after a revision request", () => {
    expect(canEditScores("DRAFT")).toBe(true);
    expect(canEditScores("NEEDS_REVISION")).toBe(true);
    expect(canEditScores("SUBMITTED")).toBe(false);
    expect(canEditScores("CONFIRMED")).toBe(false);
  });

  it("only allows submitting when there is something scored", () => {
    expect(canSubmit("DRAFT", 0)).toBe(false);
    expect(canSubmit("DRAFT", 1)).toBe(true);
    expect(canSubmit("NEEDS_REVISION", 3)).toBe(true);
    expect(canSubmit("SUBMITTED", 4)).toBe(false);
    expect(canSubmit("CONFIRMED", 4)).toBe(false);
  });

  it("only lets a waiting submission be decided", () => {
    expect(canDecide("SUBMITTED")).toBe(true);
    for (const s of ["DRAFT", "NEEDS_REVISION", "CONFIRMED"] as const) expect(canDecide(s)).toBe(false);
  });
});

describe("reviewerOf", () => {
  // Saheel scores Neha and Monisha; Neha scores mentors.
  const edges: ReviewerEdge[] = [
    { employeeEmails: ["neha@co.com", "neha.work@co.com"], scorerUserId: "saheel" },
    { employeeEmails: ["monisha@co.com"], scorerUserId: "saheel" },
    { employeeEmails: ["mentor@co.com"], scorerUserId: "neha" },
  ];

  it("a Team Lead's reviewer is whoever scores them", () => {
    expect(reviewerOf("neha", ["neha@co.com"], edges)).toBe("saheel");
  });

  it("finds them through either of their addresses", () => {
    expect(reviewerOf("neha", ["NEHA.WORK@co.com"], edges)).toBe("saheel");
  });

  it("is null at the top of the tree, so it goes straight to HR", () => {
    expect(reviewerOf("saheel", ["saheel@co.com"], edges)).toBeNull();
  });

  it("is never the submitter themselves", () => {
    const loop: ReviewerEdge[] = [{ employeeEmails: ["a@co.com"], scorerUserId: "a" }];
    expect(reviewerOf("a", ["a@co.com"], loop)).toBeNull();
  });
});

describe("mayDecide", () => {
  it("lets the named reviewer, or a role that may confirm any month, decide — nobody else", () => {
    expect(mayDecide({ id: "saheel" }, "saheel")).toBe(true);
    expect(mayDecide({ id: "root", canDecideAny: true }, "saheel")).toBe(true);
    expect(mayDecide({ id: "root", canDecideAny: true }, null)).toBe(true);
    expect(mayDecide({ id: "hr" }, "saheel")).toBe(false);
    expect(mayDecide({ id: "neha" }, "saheel")).toBe(false);
  });

  it("gives nobody but a confirm-any role the call when there is no reviewer", () => {
    expect(mayDecide({ id: "hr" }, null)).toBe(false);
  });
});

describe("mayViewScores", () => {
  it("shows an employee their own scores only once the month is confirmed", () => {
    expect(mayViewScores(true, "CONFIRMED")).toBe(true);
    for (const s of ["DRAFT", "SUBMITTED", "NEEDS_REVISION"] as const) expect(mayViewScores(true, s)).toBe(false);
  });

  it("always shows the working numbers to anyone who scores or reviews", () => {
    for (const s of ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "CONFIRMED"] as const) expect(mayViewScores(false, s)).toBe(true);
  });
});

describe("periodInPlay", () => {
  it("looks back to last month in the first days of a month", () => {
    expect(periodInPlay(new Date(Date.UTC(2026, 10, 3))).toISOString().slice(0, 7)).toBe("2026-10");
    expect(periodInPlay(new Date(Date.UTC(2026, 0, 2))).toISOString().slice(0, 7)).toBe("2025-12");
  });

  it("is the current month from the 6th onward", () => {
    expect(periodInPlay(new Date(Date.UTC(2026, 9, 6))).toISOString().slice(0, 7)).toBe("2026-10");
    expect(periodInPlay(new Date(Date.UTC(2026, 9, 31))).toISOString().slice(0, 7)).toBe("2026-10");
  });
});

describe("reminder planning", () => {
  const p = (employeeId: string, scorerUserId: string, state: PendingScoring["state"]): PendingScoring => ({
    employeeId,
    name: employeeId,
    scorerUserId,
    state,
    revisionNote: null,
    weeksScored: 0,
  });

  it("owes Team Leads a reminder only for people still in draft or sent back", () => {
    const planned = pendingByScorer([
      p("a", "neha", "DRAFT"),
      p("b", "neha", "NEEDS_REVISION"),
      p("c", "neha", "SUBMITTED"),
      p("d", "neha", "CONFIRMED"),
      p("e", "rashid", "DRAFT"),
    ]);
    expect(planned.get("neha")?.map((x) => x.employeeId)).toEqual(["a", "b"]);
    expect(planned.get("rashid")?.map((x) => x.employeeId)).toEqual(["e"]);
  });

  it("owes nothing to a Team Lead whose people are all submitted or confirmed", () => {
    expect(pendingByScorer([p("c", "neha", "SUBMITTED"), p("d", "neha", "CONFIRMED")]).size).toBe(0);
  });

  it("groups waiting submissions by reviewer, leaving unassigned ones to HR", () => {
    const waiting = waitingByReviewer([
      { reviewerUserId: "saheel", name: "Neha" },
      { reviewerUserId: "saheel", name: "Monisha" },
      { reviewerUserId: null, name: "Saheel" },
    ]);
    expect(waiting.get("saheel")).toEqual(["Neha", "Monisha"]);
    expect(waiting.size).toBe(1);
  });
});
