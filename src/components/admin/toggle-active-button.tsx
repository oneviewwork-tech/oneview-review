"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

export function ToggleActiveButton({
  id,
  isActive,
  action,
}: {
  id: string;
  isActive: boolean;
  action: (id: string) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant="outline"
      loading={isPending}
      onClick={() =>
        startTransition(async () => {
          await action(id);
          router.refresh();
        })
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
