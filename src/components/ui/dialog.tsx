"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
  // `document` only exists on the client, and the portal target has to be
  // absent during SSR. useSyncExternalStore expresses exactly that — server
  // false, client true — without a setState-in-effect round trip.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Lock the page behind the dialog, compensating for the scrollbar that
    // disappears with it so the layout doesn't jump sideways.
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Rendered through a portal, not in place.
  //
  // `position: fixed` resolves against the nearest ancestor with a
  // transform/filter/perspective rather than the viewport. Page wrappers
  // carry `animate-fade-up`, whose fill-mode leaves a transform behind, so
  // an in-place dialog was being sized against a 5000px-tall page container:
  // it could not scroll and its bottom fell off the screen. Portalling to
  // <body> puts it back on the viewport, and also frees the dropdowns inside
  // it from any `overflow` clipping on the way up the tree.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <div
        className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        onClick={onClose}
      />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          className={cn(
            "animate-scale-in relative w-full max-w-md rounded-xl border border-border bg-popover shadow-lg",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 p-5 pb-0">
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 pt-4">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
