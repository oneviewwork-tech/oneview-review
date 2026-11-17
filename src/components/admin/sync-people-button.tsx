"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { syncPeopleNow } from "@/actions/people-sync.actions";

/** Pull the latest people from ONEVIEW People right now. */
export function SyncPeopleButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await syncPeopleNow();
          push(r.success ? "success" : "error", r.message ?? "Done.");
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} /> {pending ? "Syncing…" : "Sync with People"}
    </Button>
  );
}
