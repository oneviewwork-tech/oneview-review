import { describe, it, expect } from "vitest";
import { subtreeOf, type TreeEdge } from "@/domain/performance/tree";

const edge = (employeeId: string, emails: string[], scorerEmail: string): TreeEdge => ({
  employeeId,
  employeeEmails: emails,
  scorerEmail,
});

describe("subtreeOf", () => {
  // saheel scores neha and rashid; neha scores two mentors.
  const edges = [
    edge("neha", ["neha@co.com"], "saheel@co.com"),
    edge("rashid", ["rashid@old.com", "rashid@co.com"], "saheel@co.com"),
    edge("m1", ["m1@co.com"], "neha@co.com"),
    edge("m2", ["m2@co.com"], "neha@co.com"),
    edge("d1", ["d1@co.com"], "rashid@co.com"),
  ];

  it("a lead sees the people they score and whoever those people score", () => {
    expect([...subtreeOf(["neha", "rashid"], edges)].sort()).toEqual(["d1", "m1", "m2", "neha", "rashid"]);
  });

  it("a mentor-level person sees nobody below them", () => {
    expect([...subtreeOf(["m1"], edges)]).toEqual(["m1"]);
  });

  it("does not leak sideways: one lead never sees another lead's team", () => {
    const seen = subtreeOf(["neha"], edges);
    expect(seen.has("d1")).toBe(false);
    expect(seen.has("rashid")).toBe(false);
  });

  it("finds a person through either of their addresses (login email differs from mailing email)", () => {
    // Rashid's scorer-login is rashid@co.com even though his record was filed under rashid@old.com.
    expect(subtreeOf(["rashid"], edges).has("d1")).toBe(true);
  });

  it("survives a cycle instead of looping forever", () => {
    const loop = [edge("a", ["a@co.com"], "b@co.com"), edge("b", ["b@co.com"], "a@co.com")];
    expect([...subtreeOf(["a"], loop)].sort()).toEqual(["a", "b"]);
  });
});
