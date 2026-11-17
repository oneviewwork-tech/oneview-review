"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireReviewAccess, requireOwnsEmployee } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { createSubmissionSchema, reviseSubmissionSchema } from "@/validators/submission";
import { parseReviewPeriod, formatReviewPeriod } from "@/domain/review/period";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/**
 * Submits feedback for an employee (§12).
 *
 * A Team Lead is confined to their own department, re-checked
 * server-side via requireOwnsEmployee — the dropdown being filtered on the
 * client is not the boundary (§8). An Admin may act for any department, so
 * the department is taken from the employee record itself rather than from
 * the request, which means there is nothing for a caller to forge.
 */
export async function createSubmission(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { user, departmentId, isAdmin } = await requireReviewAccess();

  const parsed = createSubmissionSchema.safeParse({
    employeeId: formData.get("employeeId"),
    reviewPeriod: formData.get("reviewPeriod"),
    templateType: formData.get("templateType"),
    feedback: formData.get("feedback"),
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  let employee;
  if (isAdmin) {
    employee = await prisma.employee.findUnique({ where: { id: parsed.data.employeeId } });
    if (!employee || !employee.isActive) return fail("That employee is not available.");
  } else {
    employee = await requireOwnsEmployee(departmentId!, parsed.data.employeeId);
  }
  // Attributed to the department the review actually happened under, which
  // for a Team Lead reviewing through an additional link (§ EmployeeDepartmentLink)
  // is their own department, not necessarily the employee's home one — that
  // keeps this submission counted in the right department's progress. An
  // Admin has no department of their own, so theirs still falls back to the
  // employee's home department.
  const department = await prisma.department.findUniqueOrThrow({
    where: { id: isAdmin ? employee.departmentId : departmentId! },
    include: { organization: { select: { id: true, name: true } } },
  });

  const now = new Date();
  // The month being reviewed is chosen, not inferred from today: feedback
  // for a month is normally written in the first days of the next one, so
  // deriving it from the clock filed August's reviews under September.
  const reviewPeriod = parseReviewPeriod(parsed.data.reviewPeriod, now);
  if (!reviewPeriod) {
    return fail("That review month is not valid.", { reviewPeriod: ["Pick a month that has already started."] });
  }

  const existing = await prisma.feedbackSubmission.findUnique({
    where: { employeeId_reviewPeriod: { employeeId: employee.id, reviewPeriod } },
  });
  if (existing) {
    return fail(
      `Feedback for ${employee.name} has already been submitted for ${formatReviewPeriod(reviewPeriod)}.`
    );
  }

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.feedbackSubmission.create({
      data: {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        organizationId: department.organization.id,
        organizationName: department.organization.name,
        departmentId: department.id,
        departmentName: department.name,
        departmentHeadId: user.id,
        departmentHeadName: user.name,
        // Captured now rather than looked up at send time: this is who gets
        // CC'd, and it must stay whoever actually submitted.
        departmentHeadEmail: user.email,
        templateType: parsed.data.templateType,
        feedback: parsed.data.feedback,
        reviewPeriod,
        submittedAt: now,
      },
    });
    await writeAuditEvent(tx, {
      entityType: "FeedbackSubmission",
      entityId: created.id,
      action: "SUBMISSION_CREATED",
      actorUserId: user.id,
      actorEmail: user.email,
      after: { employeeId: employee.id, templateType: parsed.data.templateType },
    });
    return created;
  });

  revalidatePath("/review");
  revalidatePath("/my-submissions");
  return ok(
    { id: submission.id },
    `Feedback submitted for ${employee.name}, ${formatReviewPeriod(reviewPeriod)}.`
  );
}

/**
 * Team Lead revises a submission HR sent back (§13's optional
 * NEEDS_REVISION state) and puts it back in the queue as SUBMITTED.
 * Scoped to submissions the caller's own department owns and only from
 * NEEDS_REVISION — never lets a Team Lead edit a submission HR has
 * already confirmed or sent.
 */
export async function reviseSubmission(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const { user, departmentId, isAdmin } = await requireReviewAccess();

  const parsed = reviseSubmissionSchema.safeParse({
    submissionId: formData.get("submissionId"),
    templateType: formData.get("templateType"),
    feedback: formData.get("feedback"),
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const submission = await prisma.feedbackSubmission.findUnique({ where: { id: parsed.data.submissionId } });
  // An Admin may revise any submission; a Team Lead only their own
  // department's.
  if (!submission || (!isAdmin && submission.departmentId !== departmentId)) {
    return fail("Submission not found.");
  }
  if (submission.status !== "NEEDS_REVISION") {
    return fail(`Only submissions marked "Needs Revision" can be revised (current status: ${submission.status}).`);
  }

  // reviewPeriod is deliberately left untouched: it identifies which
  // month's review this is, set once when the submission first entered
  // the pipeline. A revision (however late) is still about that same
  // month, not the month the Team Lead happens to fix it in.
  await prisma.$transaction(async (tx) => {
    await tx.feedbackSubmission.update({
      where: { id: submission.id },
      data: {
        templateType: parsed.data.templateType,
        feedback: parsed.data.feedback,
        status: "SUBMITTED",
      },
    });
    await writeAuditEvent(tx, {
      entityType: "FeedbackSubmission",
      entityId: submission.id,
      action: "SUBMISSION_REVISED",
      actorUserId: user.id,
      actorEmail: user.email,
      after: { templateType: parsed.data.templateType },
    });
  });

  revalidatePath("/my-submissions");
  revalidatePath("/submissions");
  return ok(undefined, "Revised feedback resubmitted.");
}
