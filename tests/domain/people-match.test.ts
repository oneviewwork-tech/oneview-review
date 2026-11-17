import { describe, it, expect } from "vitest";
import { matchByName, nameTokens } from "@/domain/people/match";

const people = (...names: string[]) => names.map((name, i) => ({ id: String(i), name }));

describe("nameTokens", () => {
  it("ignores case, punctuation, accents and spacing", () => {
    expect(nameTokens("  Mohammed  Rashid A. ")).toEqual(["mohammed", "rashid", "a"]);
    expect(nameTokens("José")).toEqual(["jose"]);
  });
});

describe("matchByName", () => {
  it("matches the same name regardless of case, order or punctuation", () => {
    const r = matchByName("rashid, mohammed a", people("Mohammed Rashid A", "Neha Prakash"));
    expect(r.kind).toBe("exact");
  });

  it("flags a shortened name as partial so a person has to confirm it", () => {
    const r = matchByName("Rashid", people("Mohammed Rashid A", "Neha Prakash"));
    expect(r.kind).toBe("partial");
    if (r.kind === "partial") expect(r.match.name).toBe("Mohammed Rashid A");
  });

  it("matches a longer Review name to a shorter People name as partial too", () => {
    expect(matchByName("Aysha Haneena S", people("Aysha Haneena")).kind).toBe("partial");
  });

  it("never guesses between several people who fit", () => {
    const r = matchByName("Rashid", people("Mohammed Rashid A", "Abdul Rashid", "Neha Prakash"));
    expect(r.kind).toBe("ambiguous");
  });

  it("treats two identical names as ambiguous, not as a match", () => {
    expect(matchByName("Anju Shaji", people("Anju Shaji", "Anju Shaji")).kind).toBe("ambiguous");
  });

  it("returns none when nobody fits, and for a blank name", () => {
    expect(matchByName("Ghost Person", people("Neha Prakash")).kind).toBe("none");
    expect(matchByName("   ", people("Neha Prakash")).kind).toBe("none");
  });

  it("prefers an exact match over looser ones", () => {
    const r = matchByName("Neha Prakash", people("Neha Prakash", "Neha Prakash Nair"));
    expect(r.kind).toBe("exact");
  });
});
