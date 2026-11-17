import { ForbiddenError, UnauthenticatedError } from "@/lib/rbac";
import { formatReviewPeriod, parseReviewPeriod, selectablePeriods } from "@/domain/review/period";
import { csvLine } from "@/domain/performance/csv";
import { REVIEW_STATE_LABEL } from "@/domain/performance/workflow";
import { getPerformanceAccess } from "@/services/performance/access";
import { confirmedScoresOnly, getTeamRows } from "@/services/performance/data";
import { getScopeOrganizations, resolveScope } from "@/services/review/scope";

// Per-person data: never cached, never shared.
export const dynamic = "force-dynamic";

/**
 * Downloads the dashboard's table as CSV: the same people, month and filter
 * the viewer is looking at, and only people they are allowed to see — the
 * scope comes from the same access check the dashboard uses, never from the
 * request.
 */
export async function GET(request: Request) {
  let access;
  try {
    access = await getPerformanceAccess();
  } catch (e) {
    if (e instanceof UnauthenticatedError) return new Response("Sign in first.", { status: 401 });
    if (e instanceof ForbiddenError) return new Response("Not allowed.", { status: 403 });
    throw e;
  }

  const q = new URL(request.url).searchParams;
  const period = parseReviewPeriod(q.get("period") ?? "") ?? selectablePeriods(1)[0];
  const organizations = access.isStaff ? await getScopeOrganizations() : [];
  const scope = access.isStaff ? resolveScope(organizations, { org: q.get("org") ?? undefined, department: q.get("department") ?? undefined }) : {};

  const visibleIds = access.visibleEmployeeIds ? [...access.visibleEmployeeIds] : null;
  const rows = confirmedScoresOnly(await getTeamRows(visibleIds, period, scope)).filter((r) => r.employeeId !== access.selfEmployeeId);

  const header = [
    "Organization",
    "Department",
    "Person",
    "Designation",
    "Scorecard",
    "Scored by",
    "Reviewer",
    "Status",
    "Weeks scored",
    "Performance",
    "Performance max",
    "Potential",
    "Potential max",
    "Month score",
    "Maximum",
    "Percent",
  ];
  const lines = rows.map((r) =>
    csvLine([
      r.organizationName,
      r.departmentName,
      r.name,
      r.designation,
      r.templateName,
      r.scorerName,
      r.reviewerName ?? "",
      REVIEW_STATE_LABEL[r.reviewState],
      r.weeksScored,
      r.performance,
      r.performanceMax,
      r.potential,
      r.potentialMax,
      r.average,
      r.maxTotal,
      r.average == null || r.maxTotal <= 0 ? "" : Math.round((r.average / r.maxTotal) * 1000) / 10,
    ])
  );

  // BOM so Excel reads the file as UTF-8 (names with accents survive).
  const body = "\uFEFF" + [csvLine(header), ...lines].join("\r\n") + "\r\n";
  const filename = `performance-${period.toISOString().slice(0, 7)}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Period": formatReviewPeriod(period),
    },
  });
}
