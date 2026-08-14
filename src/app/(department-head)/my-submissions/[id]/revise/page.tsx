import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Undo2 } from "lucide-react";
import { requireReviewAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReviseForm } from "@/components/review/revise-form";

export default async function RevisePage({ params }: { params: Promise<{ id: string }> }) {
  const { departmentId, user, isAdmin } = await requireReviewAccess();
  const { id } = await params;

  const submission = await prisma.feedbackSubmission.findUnique({ where: { id } });
  // An Admin can revise anything; a Department Head only their own
  // submissions, in their own department.
  const permitted =
    submission &&
    submission.status === "NEEDS_REVISION" &&
    (isAdmin || (submission.departmentId === departmentId && submission.departmentHeadId === user.id));
  if (!permitted) notFound();

  return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <Link href="/my-submissions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-ui hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to My Submissions
      </Link>

      <h1 className="text-page-title mt-4">Revise feedback for {submission.employeeName}</h1>

      {submission.revisionNote && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-700 dark:text-orange-400">
          <Undo2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">HR&apos;s note</p>
            <p className="opacity-90">{submission.revisionNote}</p>
          </div>
        </div>
      )}

      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle>Update and resubmit</CardTitle>
          <CardDescription>Address the note above, then resubmit for HR to review again.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReviseForm submissionId={submission.id} initialTemplate={submission.templateType} initialFeedback={submission.feedback} />
        </CardContent>
      </Card>
    </div>
  );
}
