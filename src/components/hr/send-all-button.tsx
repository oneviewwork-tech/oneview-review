"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendAllConfirmed } from "@/actions/hr.actions";

export function SendAllButton({ count, departmentId }: { count: number; departmentId?: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  if (count === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <Button
        loading={isPending}
        onClick={() => {
          if (!window.confirm(`Send ${count} confirmed email${count === 1 ? "" : "s"} now? This cannot be undone.`)) return;
          startTransition(async () => {
            const res = await sendAllConfirmed(departmentId);
            setResult(res.message ?? null);
            router.refresh();
          });
        }}
      >
        <Send className="h-4 w-4" />
        Send All Confirmed ({count})
      </Button>
      {result && <span className="text-sm text-muted-foreground">{result}</span>}
    </div>
  );
}
