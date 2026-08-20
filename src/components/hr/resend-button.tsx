"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { resendSubmission } from "@/actions/hr.actions";
import { useToast } from "@/components/ui/toast";

export function ResendButton({ submissionId }: { submissionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        <RotateCw className="h-3.5 w-3.5" />
        Resend
      </Button>

      {/* A themed dialog rather than window.confirm: the native one can't be
          styled, ignores dark mode, and looks nothing like the confirmation
          the bulk send already uses. */}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Send this email again?"
        description="The employee receives the same review a second time, with the submitter copied in as before."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            loading={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await resendSubmission(submissionId);
                push(res.success ? "success" : "error", res.message ?? "Email resent.");
                setConfirming(false);
                router.refresh();
              })
            }
          >
            <RotateCw className="h-3.5 w-3.5" />
            Resend now
          </Button>
        </div>
      </Dialog>
    </>
  );
}
