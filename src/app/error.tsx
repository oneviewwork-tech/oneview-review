"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="animate-fade-up w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive-subtle">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h1 className="text-page-title mt-4">Something went wrong</h1>
        <p className="text-page-subtitle mt-1">
          The page could not be loaded. Try again, and contact your admin if it keeps happening.
        </p>
        {error.digest && <p className="text-metadata mt-2 font-mono">Reference: {error.digest}</p>}
        <Button className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
