/**
 * One CSV cell, made safe.
 *
 * Spreadsheet programs run a cell that starts with =, +, - or @ as a formula,
 * so data that merely looks like one (a name, a remark) could execute when the
 * file is opened. Such values are prefixed with an apostrophe so they stay
 * text. Values containing a comma, quote or line break are quoted.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvLine = (cells: (string | number | null | undefined)[]): string => cells.map(csvCell).join(",");
