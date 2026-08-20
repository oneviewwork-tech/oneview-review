"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmSubmission } from "@/actions/hr.actions";
import { useToast } from "@/components/ui/toast";

export function ConfirmButton({ submissionId, size = "sm" }: { submissionId: string; size?: "sm" | "default" }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  return (
    <Button
      size={size}
      loading={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await confirmSubmission(submissionId);
          push(res.success ? "success" : "error", res.message ?? "Submission confirmed.");
          router.refresh();
        })
      }
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      Confirm
    </Button>
  );
}
