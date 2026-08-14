"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TemplateSelector } from "./template-selector";
import { reviseSubmission } from "@/actions/submission.actions";
import type { TemplateType } from "@prisma/client";

export function ReviseForm({
  submissionId,
  initialTemplate,
  initialFeedback,
}: {
  submissionId: string;
  initialTemplate: TemplateType;
  initialFeedback: string;
}) {
  const [state, formAction, isPending] = useActionState(reviseSubmission, undefined);
  const [templateType, setTemplateType] = useState<TemplateType>(initialTemplate);
  const [feedback, setFeedback] = useState(initialFeedback);
  const router = useRouter();

  if (state?.success) {
    return (
      <p role="status" className="animate-fade-up flex items-center gap-2 rounded-lg border border-success/20 bg-success-subtle px-3 py-2.5 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Resubmitted. HR will review it again.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="submissionId" value={submissionId} />

      <div className="space-y-1.5">
        <Label>Template</Label>
        <TemplateSelector value={templateType} onChange={setTemplateType} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback">Performance Feedback</Label>
        <Textarea
          id="feedback"
          name="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          required
        />
        {state && !state.success && state.fieldErrors?.feedback && (
          <p className="text-sm text-destructive">{state.fieldErrors.feedback[0]}</p>
        )}
      </div>

      {state && !state.success && (
        <p role="alert" className="animate-fade-up rounded-lg border border-destructive/20 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={isPending}>
          Resubmit Feedback
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/my-submissions")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
