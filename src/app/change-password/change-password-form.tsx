"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/actions/password.actions";

export function ChangePasswordForm() {
  const [state, formAction, isPending] = useActionState(changePassword, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoFocus autoComplete="current-password" />
        {state && !state.success && state.fieldErrors?.currentPassword && (
          <p className="text-sm text-destructive">{state.fieldErrors.currentPassword[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" />
        {state && !state.success && state.fieldErrors?.newPassword && (
          <p className="text-sm text-destructive">{state.fieldErrors.newPassword[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
        {state && !state.success && state.fieldErrors?.confirmPassword && (
          <p className="text-sm text-destructive">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      {state && !state.success && !state.fieldErrors && (
        <p role="alert" className="animate-fade-up rounded-lg border border-destructive/20 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" loading={isPending}>
        Update password
      </Button>
      <p className="text-metadata text-center">You will be asked to sign in again with your new password.</p>
    </form>
  );
}
