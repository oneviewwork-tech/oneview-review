"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHr } from "@/lib/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { renderEmail } from "@/domain/email/render";
import { monthNameForPeriod, yearForPeriod } from "@/domain/review/period";
import { sendReviewEmail } from "@/services/email/resend";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/** HR reviews and confirms a submission (§19). Eligible for "Send All Confirmed" once confirmed. */
export async function confirmSubmission(submissionId: string): Promise<ActionResult> {
  const user = await requireHr();

  const submission = await prisma.feedbackSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return fail("Submission not found.");
  if (submission.status !== "SUBMITTED") {
    return fail(`Only submitted feedback can be confirmed (current status: ${submission.status}).`);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.feedbackSubmission.update({
      where: { id: submissionId },
      data: { status: "CONFIRMED", confirmedById: user.id, confirmedByName: user.name, confirmedAt: now },
    });
    await writeAuditEvent(tx, {
      entityType: "FeedbackSubmission",
      entityId: submissionId,
      action: "SUBMISSION_CONFIRMED",
      actorUserId: user.id,
      actorEmail: user.email,
    });
  });

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath("/overview");
  return ok(undefined, "Submission confirmed.");
}

function buildEmail(submission: {
  templateType: "A" | "B" | "C";
  employeeName: string;
  feedback: string;
  reviewPeriod: Date;
}) {
  return renderEmail(submission.templateType, {
    employee_name: submission.employeeName,
    month_name: monthNameForPeriod(submission.reviewPeriod),
    year: String(yearForPeriod(submission.reviewPeriod)),
    feedback: submission.feedback,
  });
}

async function deliverAndRecord(
  submission: { id: string; employeeEmail: string; templateType: "A" | "B" | "C"; employeeName: string; feedback: string; reviewPeriod: Date },
  actor: { id: string; email: string },
  auditAction: "EMAIL_SENT" | "EMAIL_RESENT"
) {
  const email = buildEmail(submission);
  const result = await sendReviewEmail({ to: submission.employeeEmail, ...email });

  await prisma.$transaction(async (tx) => {
    if (result.ok) {
      await tx.feedbackSubmission.update({
        where: { id: submission.id },
        data: { status: "SENT", sentAt: new Date(), resendMessageId: result.messageId, emailError: null },
      });
      await writeAuditEvent(tx, {
        entityType: "FeedbackSubmission",
        entityId: submission.id,
        action: auditAction,
        actorUserId: actor.id,
        actorEmail: actor.email,
        metadata: { resendMessageId: result.messageId },
      });
    } else {
      // Never marked SENT on failure (§22) — status stays CONFIRMED so it
      // remains eligible for a retry via "Send All Confirmed" or "Resend".
      await tx.feedbackSubmission.update({
        where: { id: submission.id },
        data: { emailError: result.error },
      });
      await writeAuditEvent(tx, {
        entityType: "FeedbackSubmission",
        entityId: submission.id,
        action: "EMAIL_SEND_FAILED",
        actorUserId: actor.id,
        actorEmail: actor.email,
        metadata: { error: result.error },
      });
    }
  });

  return result;
}

/** Bulk-sends every CONFIRMED submission (§20). SENT ones are excluded by the status filter (§23). */
export async function sendAllConfirmed(departmentId?: string): Promise<ActionResult<{ sent: number; failed: number }>> {
  const user = await requireHr();

  const confirmed = await prisma.feedbackSubmission.findMany({
    where: { status: "CONFIRMED", ...(departmentId ? { departmentId } : {}) },
  });
  if (confirmed.length === 0) return fail("No confirmed submissions are ready to send.");

  let sent = 0;
  let failed = 0;
  for (const submission of confirmed) {
    const result = await deliverAndRecord(submission, user, "EMAIL_SENT");
    if (result.ok) sent++;
    else failed++;
  }

  revalidatePath("/submissions");
  revalidatePath("/overview");
  revalidatePath("/email-history");
  return ok(
    { sent, failed },
    failed === 0 ? `Sent ${sent} email${sent === 1 ? "" : "s"}.` : `Sent ${sent}, ${failed} failed — see status for details.`
  );
}

/** Explicit re-send for an already-SENT submission (§23) — never implicit. */
export async function resendSubmission(submissionId: string): Promise<ActionResult> {
  const user = await requireHr();

  const submission = await prisma.feedbackSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) return fail("Submission not found.");
  if (submission.status !== "SENT") {
    return fail("Only already-sent emails can be resent.");
  }

  const result = await deliverAndRecord(submission, user, "EMAIL_RESENT");

  revalidatePath("/submissions");
  revalidatePath(`/submissions/${submissionId}`);
  revalidatePath("/email-history");
  return result.ok ? ok(undefined, "Email resent.") : fail(result.error ?? "Resend failed.");
}
