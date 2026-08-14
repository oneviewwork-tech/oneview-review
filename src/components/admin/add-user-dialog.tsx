"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { createUser } from "@/actions/admin.actions";
import { ROLE_OPTIONS } from "@/lib/roles";
import type { UserRole } from "@prisma/client";

function randomPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase() + "!1";
}

export function AddUserDialog({ departments }: { departments: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>("DEPARTMENT_HEAD");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [password, setPassword] = useState(randomPassword());
  const [state, formAction, isPending] = useActionState(createUser, undefined);
  const router = useRouter();

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setPassword(randomPassword());
          setOpen(true);
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add User
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add user" description="They must change this password on first login.">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" name="name" required autoFocus />
            {state && !state.success && state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" name="email" type="email" required />
            {state && !state.success && state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role</Label>
            <Dropdown id="user-role" name="role" value={role} onChange={(v) => setRole(v as UserRole)} options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
          </div>
          {role === "DEPARTMENT_HEAD" && (
            <div className="space-y-1.5">
              <Label htmlFor="user-dept">Department</Label>
              <Dropdown
                id="user-dept"
                name="departmentId"
                value={departmentId}
                onChange={setDepartmentId}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
              {state && !state.success && state.fieldErrors?.departmentId && (
                <p className="text-sm text-destructive">{state.fieldErrors.departmentId[0]}</p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="user-password">Temporary password</Label>
            <div className="flex gap-2">
              <Input id="user-password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="button" variant="outline" size="icon" onClick={() => setPassword(randomPassword())} aria-label="Generate password">
                <Dices className="h-4 w-4" />
              </Button>
            </div>
            {state && !state.success && state.fieldErrors?.password && <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>}
          </div>
          {state && !state.success && !state.fieldErrors && <p className="text-sm text-destructive">{state.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
