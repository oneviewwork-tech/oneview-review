import { describe, it, expect } from "vitest";
import { csvCell, csvLine } from "@/domain/performance/csv";

describe("csvCell", () => {
  it("leaves ordinary values alone and renders empties as blank", () => {
    expect(csvCell("Neha Prakash")).toBe("Neha Prakash");
    expect(csvCell(89.5)).toBe("89.5");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values with commas, quotes or line breaks, doubling inner quotes", () => {
    expect(csvCell("Smith, Anna")).toBe('"Smith, Anna"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("defuses anything a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});

describe("csvLine", () => {
  it("joins escaped cells", () => {
    expect(csvLine(["a", "b,c", null, 3])).toBe('a,"b,c",,3');
  });
});
