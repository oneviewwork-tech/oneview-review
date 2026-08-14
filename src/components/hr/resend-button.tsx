"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendSubmission } from "@/actions/hr.actions";

export function ResendButton({ submissionId }: { submissionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        loading={isPending}
        onClick={() => {
          if (!window.confirm("Resend this email to the employee?")) return;
          startTransition(async () => {
            const res = await resendSubmission(submissionId);
            setMessage(res.message ?? null);
            router.refresh();
          });
        }}
      >
        <RotateCw className="h-3.5 w-3.5" />
        Resend
      </Button>
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}
