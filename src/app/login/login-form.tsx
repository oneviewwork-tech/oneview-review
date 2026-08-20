"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { authenticate } from "./actions";

const FIELD =
  "h-12 w-full rounded-lg border border-input bg-card pl-11 pr-3 text-sm shadow-xs transition-ui " +
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-brand " +
  "focus-visible:ring-2 focus-visible:ring-brand/25";

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const trackCaps = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Work email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            placeholder="you@harisand.co"
            className={FIELD}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            className={cn(FIELD, "pr-11")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground active:scale-95"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && (
          <p id="caps-warning" role="status" className="animate-fade-up flex items-center gap-1.5 text-xs font-medium text-warning">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
            Caps Lock is on
          </p>
        )}
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="animate-fade-up flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {errorMessage}
        </p>
      )}

      <Button type="submit" size="lg" className="group w-full" loading={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
        {!isPending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
      </Button>
    </form>
  );
}
