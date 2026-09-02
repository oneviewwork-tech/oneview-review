"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { createUser, updateUser } from "@/actions/admin.actions";
import { ROLE_OPTIONS } from "@/lib/roles";
import type { UserRole } from "@prisma/client";
import type { ScopeOrganization } from "@/components/hr/scope-filter";

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  organizationId: string | null;
}

function randomPassword() {
  return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-6).toUpperCase() + "!1";
}

/**
 * One dialog for both adding a user and editing one — role, scope
 * (organization/department), and password reset all live here. Mirrors
 * EmployeeDialog's add/edit split so the two forms can't drift apart.
 */
export function UserDialog({
  organizations,
  user,
}: {
  organizations: ScopeOrganization[];
  /** Omit to add; pass a user to edit their role, scope, or password. */
  user?: EditableUser;
}) {
  const editing = !!user;
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(user?.role ?? "DEPARTMENT_HEAD");
  const [organizationId, setOrganizationId] = useState(user?.organizationId ?? organizations[0]?.id ?? "");
  const departmentOptions = organizations.find((o) => o.id === organizationId)?.departments ?? [];
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? departmentOptions[0]?.id ?? "");
  const [password, setPassword] = useState(editing ? "" : randomPassword());
  const [state, formAction, isPending] = useActionState(editing ? updateUser : createUser, undefined);
  const router = useRouter();

  const [lastOrg, setLastOrg] = useState(organizationId);
  if (organizationId !== lastOrg) {
    setLastOrg(organizationId);
    setDepartmentId(departmentOptions[0]?.id ?? "");
  }

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }

  const err = (field: string) => (state && !state.success ? state.fieldErrors?.[field]?.[0] : undefined);

  return (
    <>
      {editing ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Edit ${user.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          onClick={() => {
            setPassword(randomPassword());
            setOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add User
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${user.name}` : "Add user"}
        description={
          editing
            ? "Change their role, scope, or reset their password."
            : "They must change this password on first login."
        }
      >
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="userId" value={user.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" name="name" defaultValue={user?.name} required autoFocus />
            {err("name") && <p className="text-sm text-destructive">{err("name")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" name="email" type="email" defaultValue={user?.email} required />
            {err("email") && <p className="text-sm text-destructive">{err("email")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role</Label>
            <Dropdown
              id="user-role"
              name="role"
              value={role}
              onChange={(v) => setRole(v as UserRole)}
              options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            />
          </div>

          {role === "DEPARTMENT_HEAD" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="user-org">Organization</Label>
                <Dropdown
                  id="user-org"
                  value={organizationId}
                  onChange={setOrganizationId}
                  options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-dept">Department</Label>
                <Dropdown
                  id="user-dept"
                  name="departmentId"
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder={departmentOptions.length ? "Select a department" : "No departments in this organization"}
                  options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))}
                />
                {err("departmentId") && <p className="text-sm text-destructive">{err("departmentId")}</p>}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="user-password">{editing ? "Reset password" : "Temporary password"}</Label>
            <div className="flex gap-2">
              <Input
                id="user-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? "Leave blank to keep current password" : undefined}
                required={!editing}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setPassword(randomPassword())} aria-label="Generate password">
                <Dices className="h-4 w-4" />
              </Button>
            </div>
            {editing && (
              <p className="text-metadata">Setting a password here forces them to change it again at next login.</p>
            )}
            {err("password") && <p className="text-sm text-destructive">{err("password")}</p>}
          </div>

          {state && !state.success && !state.fieldErrors && <p className="text-sm text-destructive">{state.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={role === "DEPARTMENT_HEAD" && !departmentId}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
