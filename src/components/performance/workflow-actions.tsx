"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { confirmReview, requestRevision, sendReminders, submitMonth } from "@/actions/performance-review.actions";
import type { ActionResult } from "@/lib/action-result";

/** Team Lead: hand a person's month over for review. Asks first, because it locks the scores. */
export function SubmitMonthButton({
  employeeId,
  period,
  personName,
  monthLabel,
  reviewerName,
  disabled,
  className,
}: {
  employeeId: string;
  period: string;
  personName: string;
  monthLabel: string;
  /** Null when nobody sits above — it will go straight to HR. */
  reviewerName: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  return (
    <>
      <Button className={className} disabled={disabled} onClick={() => setOpen(true)}>
        <Send className="size-4" /> Submit for review
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Submit ${personName}'s ${monthLabel}?`}
        description={
          reviewerName
            ? `${reviewerName} will review it. Until they decide, the scores are locked. If they send it back you can edit and resubmit.`
            : "Nobody sits above you in the scoring tree, so this goes straight to HR as confirmed. The scores will be locked."
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not yet
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await submitMonth(employeeId, period);
                push(r.success ? "success" : "error", r.message ?? (r.success ? "Submitted." : "Could not submit."));
                if (r.success) {
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** Reviewer: confirm (it goes to HR) or send it back with a note. */
export function ReviewDecision({ reviewId, personName, size }: { reviewId: string; personName: string; size?: "sm" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  const run = (fn: () => Promise<ActionResult>, onDone?: () => void) =>
    start(async () => {
      const r = await fn();
      push(r.success ? "success" : "error", r.message ?? (r.success ? "Done." : "Something went wrong."));
      if (r.success) {
        onDone?.();
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} disabled={pending} onClick={() => run(() => confirmReview(reviewId))}>
        <Check className="size-4" /> Confirm
      </Button>
      <Button size={size} variant="outline" disabled={pending} onClick={() => setOpen(true)}>
        <Undo2 className="size-4" /> Send back
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Send ${personName}'s scores back`}
        description="They'll get your note by email and can edit the scores and resubmit."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="revision-note">What should change?</Label>
            <Textarea
              id="revision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Week 3 attendance looks too high, please check against the sheet."
              className="min-h-28"
              maxLength={1000}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || note.trim().length < 5}
              onClick={() =>
                run(
                  () => requestRevision(reviewId, note),
                  () => {
                    setOpen(false);
                    setNote("");
                  }
                )
              }
            >
              {pending ? "Sending…" : "Send back"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** HR/Admin: nudge everyone who still owes a submission or a review. */
export function SendRemindersButton({ period }: { period: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await sendReminders(period);
          push(r.success ? "success" : "error", r.message ?? "Done.");
          router.refresh();
        })
      }
    >
      <BellRing className="size-4" /> {pending ? "Sending…" : "Send reminders"}
    </Button>
  );
}
