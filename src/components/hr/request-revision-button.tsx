"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { requestRevision } from "@/actions/hr.actions";

export function RequestRevisionButton({ submissionId, size = "sm" }: { submissionId: string; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const res = await requestRevision(submissionId, note);
      if (!res.success) {
        setError(res.message);
        return;
      }
      setOpen(false);
      setNote("");
      setError(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)}>
        <Undo2 className="h-3.5 w-3.5" />
        Request Revision
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Send back for revision"
        description="The Department Head will see this note and can resubmit."
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="revision-note">What needs to change?</Label>
            <Textarea
              id="revision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please add specific examples of the delivered work…"
              className="min-h-[100px]"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={isPending} disabled={note.trim().length < 5}>
              Send Back
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
