import { describe, it, expect } from "vitest";
import { renderEmail } from "@/domain/email/render";

const vars = {
  employee_name: "Rahul Kumar",
  month_name: "August",
  year: "2026",
  feedback: "Rahul has consistently delivered on time.",
};

describe("renderEmail", () => {
  it("substitutes variables into template A and keeps fixed copy unchanged", () => {
    const email = renderEmail("A", vars);
    expect(email.subject).toBe("Appreciation for Your Strong Performance & Contribution – August 2026");
    expect(email.text).toContain("Hi Rahul Kumar,");
    expect(email.text).toContain("the monthly performance review for August");
    expect(email.text).toContain("Rahul has consistently delivered on time.");
    expect(email.text).toContain("Regards,\nHR Team");
  });

  it("renders distinct subjects for B and C", () => {
    expect(renderEmail("B", vars).subject).toContain("Performance Feedback & Development Focus Areas");
    expect(renderEmail("C", vars).subject).toContain("Performance Improvement Feedback & Action Plan");
  });

  it("escapes HTML-unsafe characters in the feedback shown in the HTML body", () => {
    const email = renderEmail("A", { ...vars, feedback: "Great work <3 & thanks" });
    expect(email.html).toContain("Great work &lt;3 &amp; thanks");
    expect(email.html).not.toContain("<3 &");
  });

  it("only the feedback block differs between two submissions using the same template", () => {
    const a = renderEmail("A", vars);
    const b = renderEmail("A", { ...vars, feedback: "A completely different feedback body." });
    const aParagraphs = a.text.split("\n\n");
    const bParagraphs = b.text.split("\n\n");
    expect(aParagraphs.length).toBe(bParagraphs.length);
    const diffIndexes = aParagraphs.map((p, i) => (p !== bParagraphs[i] ? i : -1)).filter((i) => i >= 0);
    expect(diffIndexes).toEqual([3]);
  });
});
