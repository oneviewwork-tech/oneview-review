/**
 * Imports the real employee/department data from HR's spreadsheet.
 *
 * Run with:  npm run db:import -- "C:/path/to/HRMS DATA - DEP.xlsx" [ORG_CODE]
 *
 * The workbook is one sheet per department, and it is not uniform:
 *
 *  - Most sheets are  EMPLOYEE NAME | DESIGNATION | REPORTING MANAGER | email
 *    with a header row (the email column header is sometimes blank).
 *  - `tech` and `CSUITE` instead use  "Name - Designation" | email  and have
 *    no header row and no reporting manager.
 *  - Several C-suite people have no mailbox at all. They are reported and
 *    skipped rather than invented, because email is the identity of an
 *    employee here and is what the review is ultimately sent to.
 *
 * Re-running is safe: employees are matched on email and updated in place,
 * so correcting the sheet and importing again converges rather than
 * duplicating.
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Sheet name -> the department name and code we want to store. */
const DEPARTMENTS: Record<string, { name: string; code: string }> = {
  tech: { name: "Tech", code: "TECH" },
  csuite: { name: "C-Suite", code: "CSUITE" },
  hr: { name: "HR", code: "HR" },
  bd: { name: "Business Development", code: "BD" },
  "social media": { name: "Social Media", code: "SOCIAL" },
  accounts: { name: "Accounts", code: "ACCOUNTS" },
  marketing: { name: "Marketing", code: "MARKETING" },
  seo: { name: "SEO", code: "SEO" },
  web: { name: "Web", code: "WEB" },
  performance: { name: "Performance Marketing", code: "PERFORMANCE" },
  branding: { name: "Branding", code: "BRANDING" },
  // The workbook leaves this tab named "Sheet10"; its rows are all project
  // delivery roles (Project Manager, Project Operator), so it is imported
  // as Projects. Rename the tab in the source to change this.
  sheet10: { name: "Projects", code: "PROJECTS" },
};

/** Sheets laid out as "Name - Designation" | email, with no header row. */
const NAME_DASH_DESIGNATION_SHEETS = new Set(["tech", "csuite"]);

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const v = value as unknown as Record<string, unknown>;
    if ("text" in v) return String(v.text).trim();
    if ("result" in v) return String(v.result ?? "").trim();
    if ("richText" in v) {
      return (v.richText as { text: string }[]).map((t) => t.text).join("").trim();
    }
    if ("hyperlink" in v) return String(v.hyperlink).replace(/^mailto:/i, "").trim();
    return "";
  }
  return String(value).trim();
}

function findEmail(values: string[]): string | null {
  const match = values.find((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
  return match ? match.toLowerCase() : null;
}

interface ParsedEmployee {
  name: string;
  email: string | null;
  designation: string | null;
  reportingManagerName: string | null;
}

function parseSheet(ws: ExcelJS.Worksheet): ParsedEmployee[] {
  const key = ws.name.trim().toLowerCase();
  const dashStyle = NAME_DASH_DESIGNATION_SHEETS.has(key);
  const out: ParsedEmployee[] = [];

  ws.eachRow((row, rowNumber) => {
    const values: string[] = [];
    for (let c = 1; c <= Math.max(ws.columnCount, 4); c++) values.push(cellText(row.getCell(c).value));
    if (values.every((v) => v === "")) return;

    const first = values[0];
    // Header rows, and the stray "C-Suite" title cell in that sheet.
    if (/^employee\s*name$/i.test(first) || /^c-?suite$/i.test(first)) return;
    if (rowNumber === 1 && !dashStyle && /designation/i.test(values[1] ?? "")) return;

    const email = findEmail(values);

    if (dashStyle) {
      // "Ahammed Najad P - Tech Assistant"
      const [namePart, ...rest] = first.split(" - ");
      out.push({
        name: namePart.trim(),
        email,
        designation: rest.join(" - ").trim() || null,
        reportingManagerName: null,
      });
      return;
    }

    const manager = values[2]?.trim() || null;
    out.push({
      name: first,
      email,
      designation: values[1]?.trim() || null,
      // A few heads are listed as reporting to themselves, which means "is
      // the head" rather than a real reporting line — drop it.
      reportingManagerName: manager && manager.toLowerCase() !== first.toLowerCase() ? manager : null,
    });
  });

  return out;
}

async function main() {
  const file = process.argv[2];
  const orgCode = (process.argv[3] ?? "HARISCO").toUpperCase();
  if (!file) {
    console.error('Usage: npm run db:import -- "<path to xlsx>" [ORG_CODE]');
    process.exit(1);
  }

  const organization = await prisma.organization.findUnique({ where: { code: orgCode } });
  if (!organization) {
    const all = await prisma.organization.findMany({ select: { code: true } });
    console.error(`No organization with code "${orgCode}". Known: ${all.map((o) => o.code).join(", ")}`);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));

  console.log(`Importing "${path.basename(file)}" into ${organization.name} (${organization.code})\n`);

  const skipped: { sheet: string; name: string; reason: string }[] = [];
  const seenEmails = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let departments = 0;

  for (const ws of wb.worksheets) {
    const key = ws.name.trim().toLowerCase();
    const meta = DEPARTMENTS[key];
    if (!meta) {
      console.log(`- skipping unrecognised sheet "${ws.name}"`);
      continue;
    }

    // Match on code *or* name: a department may already exist under an
    // older code (the demo seed used BRAND where HR's sheet means BRANDING),
    // and it may already carry real submissions, so it has to be reconciled
    // in place rather than duplicated alongside a same-named twin.
    const existingDept = await prisma.department.findFirst({
      where: {
        organizationId: organization.id,
        OR: [{ code: meta.code }, { name: meta.name }],
      },
    });
    const department = existingDept
      ? await prisma.department.update({
          where: { id: existingDept.id },
          data: { name: meta.name, code: meta.code },
        })
      : await prisma.department.create({
          data: { organizationId: organization.id, name: meta.name, code: meta.code },
        });
    departments++;

    const rows = parseSheet(ws);
    let sheetCreated = 0;
    let sheetUpdated = 0;

    for (const row of rows) {
      if (!row.name) continue;
      if (!row.email) {
        skipped.push({ sheet: ws.name, name: row.name, reason: "no email in the sheet" });
        continue;
      }
      const previous = seenEmails.get(row.email);
      if (previous) {
        skipped.push({ sheet: ws.name, name: row.name, reason: `duplicate email, already used by ${previous}` });
        continue;
      }
      seenEmails.set(row.email, `${row.name} (${ws.name})`);

      const existing = await prisma.employee.findUnique({ where: { email: row.email } });
      await prisma.employee.upsert({
        where: { email: row.email },
        update: {
          name: row.name,
          organizationId: organization.id,
          departmentId: department.id,
          designation: row.designation,
          reportingManagerName: row.reportingManagerName,
          isActive: true,
        },
        create: {
          name: row.name,
          email: row.email,
          organizationId: organization.id,
          departmentId: department.id,
          designation: row.designation,
          reportingManagerName: row.reportingManagerName,
        },
      });
      if (existing) {
        updated++;
        sheetUpdated++;
      } else {
        created++;
        sheetCreated++;
      }
    }

    console.log(`  ${meta.name.padEnd(24)} +${sheetCreated} new, ${sheetUpdated} updated`);
  }

  console.log(`\nDepartments touched: ${departments}`);
  console.log(`Employees created:   ${created}`);
  console.log(`Employees updated:   ${updated}`);

  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} row(s) — these need attention in the sheet:`);
    for (const s of skipped) console.log(`  [${s.sheet}] ${s.name} — ${s.reason}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
