"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { PeoplePicker } from "@/components/admin/people-picker";
import { createUser, updateUser } from "@/actions/admin.actions";
import type { PeopleAccount } from "@/services/people/directory";
import type { UserRole } from "@prisma/client";
import type { ScopeOrganization } from "@/components/hr/scope-filter";

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  departmentId: string | null;
  organizationId: string | null;
}

/** A role this person may hand out (the server checks again). */
export interface AssignableRole {
  id: string;
  name: string;
  baseRole: UserRole;
  description: string | null;
  /** The organization the role is limited to, if any. */
  organizationName: string | null;
}

/**
 * One dialog for both adding a user and editing one — role and scope
 * (organization/department) live here; the password does not, because it is
 * People's. Mirrors
 * EmployeeDialog's add/edit split so the two forms can't drift apart.
 */
export function UserDialog({
  organizations,
  user,
  roles,
}: {
  organizations: ScopeOrganization[];
  /** Omit to add; pass a user to edit their role or scope. */
  user?: EditableUser;
  /** The roles this person may give. */
  roles: AssignableRole[];
}) {
  const editing = !!user;
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PeopleAccount | null>(null);
  const [roleId, setRoleId] = useState(user?.roleId ?? roles.find((r) => r.baseRole === "EMPLOYEE")?.id ?? roles[0]?.id ?? "");
  const picked_role = roles.find((r) => r.id === roleId);
  const role: UserRole = picked_role?.baseRole ?? "EMPLOYEE";
  const [organizationId, setOrganizationId] = useState(user?.organizationId ?? organizations[0]?.id ?? "");
  const departmentOptions = organizations.find((o) => o.id === organizationId)?.departments ?? [];
  const [departmentId, setDepartmentId] = useState(user?.departmentId ?? departmentOptions[0]?.id ?? "");
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
        <Button onClick={() => setOpen(true)}>
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
            ? "Change their Review role or scope. Saving also clears any sign-in lockout."
            : "Give someone who already has a ONEVIEW People account a role in Review."
        }
      >
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="userId" value={user.id} />}

          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Name</Label>
                <Input id="user-name" name="name" defaultValue={user?.name} required autoFocus />
                {err("name") && <p className="text-sm text-destructive">{err("name")}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="user-email">Sign-in email</Label>
                <Input id="user-email" name="email" type="email" defaultValue={user?.email} required />
                <p className="text-metadata">Must be their ONEVIEW People login. Change it only to repair a mismatch.</p>
                {err("email") && <p className="text-sm text-destructive">{err("email")}</p>}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Person in ONEVIEW People</Label>
              <PeoplePicker picked={picked} onPick={setPicked} />
              {/* The server re-reads the name from People; these only say who. */}
              <input type="hidden" name="name" value={picked?.name ?? ""} />
              <input type="hidden" name="email" value={picked?.email ?? ""} />
              {err("email") && <p className="text-sm text-destructive">{err("email")}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="user-role">Role in Review</Label>
            <Dropdown
              id="user-role"
              name="roleId"
              value={roleId}
              onChange={setRoleId}
              options={roles.map((r) => ({ value: r.id, label: r.name, hint: r.organizationName ?? undefined }))}
            />
            {picked_role?.description && <p className="text-metadata">{picked_role.description}</p>}
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

          <p className="text-metadata">Passwords are managed in ONEVIEW People; they sign in here with the same email and password.</p>

          {state && !state.success && !state.fieldErrors && <p className="text-sm text-destructive">{state.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isPending}
              disabled={(role === "DEPARTMENT_HEAD" && !departmentId) || (!editing && !picked)}
            >
              {editing ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
