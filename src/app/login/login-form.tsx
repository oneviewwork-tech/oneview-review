"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authenticate } from "./actions";

/**
 * Underlined fields rather than boxed ones: the form sits on plain white
 * with nothing else competing for attention, so a full border per field
 * would be more frame than it needs.
 */
const FIELD =
  "h-11 w-full border-0 border-b-2 border-input bg-transparent px-0 text-[15px] font-semibold text-foreground " +
  "outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/70 " +
  "hover:border-muted-foreground/50 focus:border-brand";

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const trackCaps = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="email" className="text-[13px] font-medium text-muted-foreground">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          placeholder="you@harisand.co"
          className={cn(FIELD, "mt-1.5")}
        />
      </div>

      <div>
        <label htmlFor="password" className="text-[13px] font-medium text-muted-foreground">
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            onKeyUp={trackCaps}
            onKeyDown={trackCaps}
            aria-describedby={capsLock ? "caps-warning" : undefined}
            className={cn(FIELD, "pr-10")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-0 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground active:scale-95"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {/* Where the reference keeps "Remember me / Forgot password". Neither
          applies here - the password lives in People - so the row carries the
          Caps Lock warning instead, and otherwise says where to change it. */}
      <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
        {capsLock ? (
          <p id="caps-warning" role="status" className="animate-fade-up flex items-center gap-1.5 font-medium text-warning">
            <span aria-hidden className="inline-block size-1.5 rounded-full bg-warning" />
            Caps Lock is on
          </p>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">Change your password in ONEVIEW People</span>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="animate-fade-up flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {errorMessage}
        </p>
      )}

      {/* The offset shadow is the reference's one piece of real character:
          the button sits slightly proud of the page and presses into it. */}
      <Button
        type="submit"
        size="lg"
        loading={isPending}
        className={cn(
          "group h-[52px] w-full rounded-xl text-[15px] font-bold",
          "shadow-[4px_4px_0_0_var(--ink)] hover:bg-brand hover:shadow-[2px_2px_0_0_var(--ink)]",
          "active:translate-x-[3px] active:translate-y-[3px] active:scale-100 active:shadow-none",
          "motion-reduce:translate-x-0 motion-reduce:translate-y-0"
        )}
      >
        {isPending ? "Signing in…" : "Login To Your Account"}
        {!isPending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
      </Button>
    </form>
  );
}
