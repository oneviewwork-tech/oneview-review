import { prisma } from "@/lib/prisma";
import type { SubmissionStatus, TemplateType } from "@prisma/client";
import type { PerformanceAccess } from "@/services/performance/access";

export interface PersonFeedbackItem {
  id: string;
  reviewPeriod: Date;
  templateType: TemplateType;
  status: SubmissionStatus;
  submittedBy: string;
  /** The feedback text itself, only for people allowed to read it. */
  feedback: string | null;
  /** HR/Admin may open the full review (preview, confirm, send). */
  canOpen: boolean;
}

/**
 * The feedback side of a person's page, so Feedback and Performance read as
 * one product instead of two.
 *
 * Visibility mirrors who may see the feedback today:
 *  - HR/Admin see every submission, in every state;
 *  - the person themself sees only what has actually been sent to them —
 *    a draft awaiting HR's confirmation is not theirs to read yet;
 *  - a Team Lead sees what they themselves submitted about the person.
 * Anyone else sees nothing, however far up the scoring tree they sit.
 */
export async function getPersonFeedback(access: PerformanceAccess, employeeId: string): Promise<PersonFeedbackItem[]> {
  const isSelf = access.selfEmployeeId === employeeId;

  const rows = await prisma.feedbackSubmission.findMany({
    where: {
      employeeId,
      ...(access.isStaff
        ? {}
        : { OR: [{ departmentHeadId: access.user.id }, ...(isSelf ? [{ status: "SENT" as const }] : [])] }),
    },
    orderBy: { reviewPeriod: "desc" },
    select: {
      id: true,
      reviewPeriod: true,
      templateType: true,
      status: true,
      departmentHeadId: true,
      departmentHeadName: true,
      feedback: true,
    },
  });

  return rows.map((r) => {
    const mine = r.departmentHeadId === access.user.id;
    const readable = access.isStaff || mine || (isSelf && r.status === "SENT");
    return {
      id: r.id,
      reviewPeriod: r.reviewPeriod,
      templateType: r.templateType,
      status: r.status,
      submittedBy: r.departmentHeadName,
      feedback: readable ? r.feedback : null,
      canOpen: access.isStaff,
    };
  });
}
