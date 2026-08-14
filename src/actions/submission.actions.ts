"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDepartmentHead, requireOwnsEmployee } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { createSubmissionSchema } from "@/validators/submission";
import { reviewPeriodForDate } from "@/domain/review/period";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/**
 * Department Head submits feedback for one of their own employees (§12).
 * Employee ownership is re-checked server-side via requireOwnsEmployee —
 * the dropdown being department-filtered on the client is not the real
 * boundary (§8).
 */
export async function createSubmission(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { user, departmentId } = await requireDepartmentHead();

  const parsed = createSubmissionSchema.safeParse({
    employeeId: formData.get("employeeId"),
    templateType: formData.get("templateType"),
    feedback: formData.get("feedback"),
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const employee = await requireOwnsEmployee(departmentId, parsed.data.employeeId);
  const department = await prisma.department.findUniqueOrThrow({ where: { id: departmentId } });

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
