"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ push: (tone: ToastTone, message: string) => void } | null>(null);

/**
 * Confirmation for actions that leave no other trace on screen.
 *
 * Sending or confirming used to report itself as a line of text wedged next
 * to the button, which is easy to miss and shifts the layout. A toast sits
 * in one predictable place and announces itself to assistive tech.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, message }]);
    // Errors stay noticeably longer — they usually need reading twice.
    setTimeout(() => setToasts((c) => c.filter((t) => t.id !== id)), tone === "error" ? 8000 : 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            role="region"
            aria-label="Notifications"
            className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={() => setToasts((c) => c.filter((x) => x.id !== t.id))} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

const TONE = {
  success: { icon: CheckCircle2, className: "border-success/25 bg-success-subtle text-success" },
  error: { icon: AlertCircle, className: "border-destructive/25 bg-destructive-subtle text-destructive" },
  info: { icon: Info, className: "border-brand/25 bg-brand-subtle text-brand" },
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { icon: Icon, className } = TONE[toast.tone];
  return (
    <div
      role="status"
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className={cn(
        "animate-fade-up pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card px-3.5 py-3 text-sm elevation-overlay",
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 break-words font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-60 transition-ui hover:bg-foreground/5 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
