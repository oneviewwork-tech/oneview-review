import { describe, it, expect } from "vitest";
import { renderEmail, defaultTemplate } from "@/domain/email/render";

describe("HR-edited wording", () => {
  const vars = { employee_name: "Rahul", month_name: "October", year: "2026", feedback: "Great <work> & more" };

  it("uses the edited subject and paragraphs, still filling and escaping values", () => {
    const e = renderEmail("B", vars, { subject: "Your {{month_name}} review", body: "Hi {{employee_name}},\n\n{{feedback}}\n\n  \nThanks" });
    expect(e.subject).toBe("Your October review");
    expect(e.text).toBe("Hi Rahul,\n\nGreat <work> & more\n\nThanks");
    expect(e.html).toContain("Great &lt;work&gt; &amp; more");
    expect(e.html.match(/<p>/g)).toHaveLength(3);
  });

  it("round-trips the built-in wording through the editable shape unchanged", () => {
    for (const t of ["A", "B", "C"] as const) expect(renderEmail(t, vars, defaultTemplate(t))).toEqual(renderEmail(t, vars));
  });
});
