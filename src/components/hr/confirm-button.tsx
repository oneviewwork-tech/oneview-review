"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { confirmSubmission } from "@/actions/hr.actions";

export function ConfirmButton({ submissionId }: { submissionId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="outline"
      loading={isPending}
      onClick={() =>
        startTransition(async () => {
          await confirmSubmission(submissionId);
          router.refresh();
        })
      }
    >
      Confirm
    </Button>
  );
}
