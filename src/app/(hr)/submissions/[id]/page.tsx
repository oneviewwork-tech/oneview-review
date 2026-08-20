import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { renderEmail } from "@/domain/email/render";
import { monthNameForPeriod, yearForPeriod, formatReviewPeriod } from "@/domain/review/period";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="mx-auto max-w-2xl animate-fade-up">
      <Link href="/submissions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-ui hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Submissions
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title">{submission.employeeName}</h1>
          <p className="text-page-subtitle mt-1">
            {submission.departmentName} · {formatReviewPeriod(submission.reviewPeriod)}
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      {submission.status === "NEEDS_REVISION" && submission.revisionNote && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-700 dark:text-orange-400">
          <Undo2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Sent back to the Department Head</p>
            <p className="break-words opacity-90">{submission.revisionNote}</p>
          </div>
        </div>
      )}

      <Card className="mt-6" interactive>
        <CardHeader>
          <CardTitle>Submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Employee" value={submission.employeeName} />
          <Row label="Email" value={submission.employeeEmail} />
          <Row label="Department" value={submission.departmentName} />
          <Row label="Template" value={`Template ${submission.templateType}`} />
          <Row
            label="Submitted by"
            value={
              submission.departmentHeadEmail
                ? `${submission.departmentHeadName} (${submission.departmentHeadEmail})`
                : submission.departmentHeadName
            }
          />
          <div>
            <p className="text-metadata mb-1">Performance Feedback</p>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-foreground">{submission.feedback}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6" interactive>
        <CardHeader>
          <CardTitle>Generated Email Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="mb-4 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-metadata">To</dt>
              <dd className="min-w-0 break-words font-medium text-foreground">{submission.employeeEmail}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-metadata">Cc</dt>
              <dd className="min-w-0 break-words text-foreground">
                {submission.departmentHeadEmail ? (
                  <>
                    {submission.departmentHeadEmail}
                    <span className="text-metadata"> · {submission.departmentHeadName}, who submitted this</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    No copy — this submission predates the Cc, or its submitter was removed.
                  </span>
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-metadata">Subject</dt>
              <dd className="min-w-0 break-words font-medium text-foreground">{email.subject}</dd>
            </div>
          </dl>
          <div className="break-words rounded-lg border border-border bg-surface-sunken p-4 text-sm text-foreground [&>p]:mb-3 [&>p:last-child]:mb-0" dangerouslySetInnerHTML={{ __html: email.html }} />
        </CardContent>
      </Card>

      {submission.emailError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Last send attempt failed</p>
            <p className="break-words text-destructive/80">{submission.emailError}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {submission.status === "SUBMITTED" && (
          <>
            <RequestRevisionButton submissionId={submission.id} size="default" />
            <ConfirmButton submissionId={submission.id} />
          </>
        )}
        {submission.status === "SENT" && <ResendButton submissionId={submission.id} />}
        {submission.status === "CONFIRMED" && (
          <p className="text-sm text-muted-foreground">
            Confirmed. Use <Link href="/submissions" className="font-medium text-brand hover:underline">Send All Confirmed</Link> to deliver it.
          </p>
        )}
        {submission.status === "NEEDS_REVISION" && (
          <p className="text-sm text-muted-foreground">Waiting on the Department Head to resubmit.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-metadata shrink-0">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
