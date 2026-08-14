"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // The overlay itself scrolls, rather than the dialog having its own
    // inner scroll area: an absolutely-positioned child (the Dropdown menu)
    // would be clipped by an overflow container, so keeping the scroll out
    // here lets tall content and open dropdowns both stay reachable on a
    // short viewport.
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <div className="fixed inset-0 animate-scale-in bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          className={cn(
            "animate-fade-up relative w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-lg",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="dialog-title" className="text-section-title">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
