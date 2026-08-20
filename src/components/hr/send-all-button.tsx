"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { sendAllConfirmed } from "@/actions/hr.actions";

export function SendAllButton({
  count,
  organizationId,
  departmentId,
}: {
  count: number;
  organizationId?: string;
  departmentId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => setConfirming(true)}>
        <Send className="h-4 w-4" />
        Send All Confirmed ({count})
      </Button>
      {result && <span className="text-sm text-muted-foreground">{result}</span>}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Send ${count} email${count === 1 ? "" : "s"}?`}
        description="Emails go to employees immediately and cannot be unsent. Only confirmed submissions in the current filter are included."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            loading={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await sendAllConfirmed({ organizationId, departmentId });
                setResult(res.message ?? null);
                setConfirming(false);
                router.refresh();
              })
            }
          >
            <Send className="h-4 w-4" />
            Send now
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
