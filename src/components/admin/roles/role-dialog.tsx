"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import type { ReviewPermission, UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { saveRole } from "@/actions/roles.actions";
import { BASE_ROLE_HINT, PERMISSION_GROUPS } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";

export interface EditableRole {
  id: string;
  name: string;
  description: string | null;
  baseRole: UserRole;
  isSystem: boolean;
  permissions: ReviewPermission[];
  homeOrganizationId: string | null;
}

/**
 * Create or edit a role: its name, what kind of account it is, which
 * organization it's limited to, and its permissions. Permissions the editor
 * doesn't have are shown but can't be ticked (the server refuses them too).
 */
export function RoleDialog({
  role,
  organizations,
  grantable,
  lockedOrganizationId,
  canMakeAdminType,
}: {
  /** Omit to create. */
  role?: EditableRole;
  organizations: { id: string; name: string }[];
  /** Permissions the editor may hand out. */
  grantable: ReviewPermission[];
  /** Set when the editor is limited to one organization: new roles must be too. */
  lockedOrganizationId: string | null;
  canMakeAdminType: boolean;
}) {
  const editing = !!role;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [baseRole, setBaseRole] = useState<UserRole>(role?.baseRole ?? "HR");
  const [org, setOrg] = useState(role?.homeOrganizationId ?? lockedOrganizationId ?? "");
  const [perms, setPerms] = useState<Set<ReviewPermission>>(new Set(role?.permissions ?? []));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();
  const can = new Set(grantable);

  const toggle = (p: ReviewPermission) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveRole({
        roleId: role?.id,
        name,
        description,
        baseRole,
        permissions: [...perms],
        homeOrganizationId: org || undefined,
      });
      if (!r.success) return setError(r.message);
      push("success", r.message ?? "Saved.");
      setOpen(false);
      router.refresh();
    });

  const kinds: UserRole[] = canMakeAdminType ? ["HR", "DEPARTMENT_HEAD", "EMPLOYEE", "ADMIN"] : ["HR", "DEPARTMENT_HEAD", "EMPLOYEE"];

  return (
    <>
      {editing ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Edit ${role.name}`}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-3.5" /> New role
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${role.name}` : "New role"}
        description="A role is a set of permissions, optionally limited to one organization."
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HR · HACA"
                disabled={role?.isSystem}
                autoFocus
              />
              {role?.isSystem && <p className="text-metadata">Built-in roles keep their name.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Kind of account</Label>
              <Dropdown
                value={baseRole}
                onChange={(v) => setBaseRole(v as UserRole)}
                disabled={role?.isSystem}
                options={kinds.map((k) => ({ value: k, label: ROLE_LABEL[k] }))}
              />
              <p className="text-metadata">{BASE_ROLE_HINT[baseRole]}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for" />
          </div>

          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Dropdown
              value={org}
              onChange={setOrg}
              disabled={!!lockedOrganizationId}
              options={[
                ...(lockedOrganizationId ? [] : [{ value: "", label: "Every organization" }]),
                ...organizations.map((o) => ({ value: o.id, label: `${o.name} only` })),
              ]}
            />
            <p className="text-metadata">Limited to one organization, the role only ever sees and manages that organization.</p>
          </div>

          <div>
            <Label>Permissions</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.key} className="rounded-2xl border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                  <ul className="mt-2 space-y-1.5">
                    {g.permissions.map((p) => {
                      const allowed = can.has(p.key);
                      return (
                        <li key={p.key}>
                          <label className={cn("flex cursor-pointer items-start gap-2 text-sm", !allowed && "cursor-not-allowed opacity-50")} title={p.description}>
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 accent-[var(--brand)]"
                              checked={perms.has(p.key)}
                              disabled={!allowed}
                              onChange={() => toggle(p.key)}
                            />
                            <span className="leading-snug">{p.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" loading={pending} disabled={name.trim().length < 2} onClick={submit}>
              {editing ? "Save role" : "Create role"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
