"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";

/**
 * Icon-only, because this sits on every row of a ~90-row table: spelling out
 * "Deactivate" ninety times made the actions louder than the data they act
 * on. The label survives as the accessible name and the tooltip.
 */
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
  const label = isActive ? "Deactivate" : "Reactivate";
  const Icon = isActive ? UserMinus : UserCheck;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-busy={isPending || undefined}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await action(id);
          router.refresh();
        })
      }
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-ui",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50 active:scale-95",
        isActive ? "hover:text-destructive" : "hover:text-success"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", isPending && "animate-pulse")} />
    </button>
  );
}
