import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { renderEmail } from "@/domain/email/render";
import { monthNameForPeriod, yearForPeriod, formatReviewPeriod } from "@/domain/review/period";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmailPreview } from "@/components/shared/email-preview";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/hr/confirm-button";
import { ResendButton } from "@/components/hr/resend-button";
import { RequestRevisionButton } from "@/components/hr/request-revision-button";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await prisma.feedbackSubmission.findUnique({ where: { id } });
  if (!submission) notFound();

  const email = renderEmail(submission.templateType, {
    employee_name: submission.employeeName,
    month_name: monthNameForPeriod(submission.reviewPeriod),
    year: String(yearForPeriod(submission.reviewPeriod)),
    feedback: submission.feedback,
  });

  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-6">
      <div>
        <Link
          href="/submissions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-ui hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Submissions
        </Link>

        <PageHeader
          className="mt-4"
          eyebrow={`${submission.organizationName} · ${submission.departmentName}`}
          title={submission.employeeName}
          description={`Review period ${formatReviewPeriod(submission.reviewPeriod)} · submitted by ${submission.departmentHeadName}`}
          actions={<StatusBadge status={submission.status} />}
        />
      </div>

      {submission.status === "NEEDS_REVISION" && submission.revisionNote && (
        <Callout icon={Undo2} title="Sent back to the Department Head">
          {submission.revisionNote}
        </Callout>
      )}

      {submission.emailError && (
        <Callout icon={AlertTriangle} title="Last send attempt failed">
          {submission.emailError}
        </Callout>
      )}

      {/* The feedback stands alone, because it is the only part a person
          wrote — everything around it in the email is fixed template copy. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle>Feedback from {submission.departmentHeadName}</CardTitle>
          <Badge variant="neutral">Template {submission.templateType}</Badge>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-3.5 text-sm leading-relaxed text-foreground">
            {submission.feedback}
          </p>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-eyebrow mb-2.5">Email preview</h2>
        <EmailPreview
          to={submission.employeeEmail}
          cc={
            submission.departmentHeadEmail
              ? {
                  address: submission.departmentHeadEmail,
                  note: `${submission.departmentHeadName}, who submitted this`,
                }
              : null
          }
          subject={email.subject}
          html={email.html}
        />
        <p className="text-metadata mt-2">This is exactly what the employee receives.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
        {submission.status === "SUBMITTED" && (
          <>
            <ConfirmButton submissionId={submission.id} size="default" />
            <RequestRevisionButton submissionId={submission.id} size="default" />
            <p className="text-metadata">Confirming makes it eligible for the next bulk send.</p>
          </>
        )}
        {submission.status === "CONFIRMED" && (
          <p className="text-sm text-muted-foreground">
            Confirmed and waiting to go out. Use{" "}
            <Link href="/submissions" className="font-medium text-brand hover:underline">
              Send All Confirmed
            </Link>{" "}
            to deliver it.
          </p>
        )}
        {submission.status === "SENT" && (
          <>
            <ResendButton submissionId={submission.id} />
            <p className="text-metadata">
              Sent {submission.sentAt?.toLocaleString() ?? ""}. Resending delivers the same email again.
            </p>
          </>
        )}
        {submission.status === "NEEDS_REVISION" && (
          <p className="text-sm text-muted-foreground">Waiting on the Department Head to resubmit.</p>
        )}
      </div>
    </div>
  );
}

function Callout({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Undo2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-destructive/25 bg-destructive-subtle px-3.5 py-3 text-sm text-destructive">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="break-words opacity-90">{children}</p>
      </div>
    </div>
  );
}
