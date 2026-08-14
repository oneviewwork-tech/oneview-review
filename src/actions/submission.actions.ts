"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireReviewAccess, requireOwnsEmployee } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { createSubmissionSchema, reviseSubmissionSchema } from "@/validators/submission";
import { reviewPeriodForDate } from "@/domain/review/period";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/**
 * Submits feedback for an employee (§12).
 *
 * A Department Head is confined to their own department, re-checked
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
  const department = await prisma.department.findUniqueOrThrow({ where: { id: employee.departmentId } });

  const now = new Date();
  const reviewPeriod = reviewPeriodForDate(now);

  const existing = await prisma.feedbackSubmission.findUnique({
    where: { employeeId_reviewPeriod: { employeeId: employee.id, reviewPeriod } },
  });
  if (existing) {
    return fail(
      `Feedback for ${employee.name} has already been submitted for this month.`
    );
  }

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.feedbackSubmission.create({
      data: {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeEmail: employee.email,
        departmentId: department.id,
        departmentName: department.name,
        departmentHeadId: user.id,
        departmentHeadName: user.name,
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
  return ok({ id: submission.id }, `Feedback submitted for ${employee.name}.`);
}

/**
 * Department Head revises a submission HR sent back (§13's optional
 * NEEDS_REVISION state) and puts it back in the queue as SUBMITTED.
 * Scoped to submissions the caller's own department owns and only from
 * NEEDS_REVISION — never lets a Department Head edit a submission HR has
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
  // An Admin may revise any submission; a Department Head only their own
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
  // month, not the month the Department Head happens to fix it in.
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
