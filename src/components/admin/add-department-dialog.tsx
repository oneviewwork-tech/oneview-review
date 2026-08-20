"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { createDepartment } from "@/actions/admin.actions";

export function AddDepartmentDialog({ organizations }: { organizations: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [state, formAction, isPending] = useActionState(createDepartment, undefined);
  const router = useRouter();

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
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add Department
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add department"
        description="Creates a department that employees and heads can be assigned to."
      >
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dept-org">Organization</Label>
            <Dropdown
              id="dept-org"
              name="organizationId"
              value={organizationId}
              onChange={setOrganizationId}
              options={organizations.map((o) => ({ value: o.id, label: o.name }))}
            />
            {err("organizationId") && <p className="text-sm text-destructive">{err("organizationId")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" name="name" placeholder="e.g. Web" required autoFocus />
            {err("name") && <p className="text-sm text-destructive">{err("name")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-code">Code</Label>
            <Input id="dept-code" name="code" placeholder="e.g. WEB" className="uppercase" required />
            {err("code") && <p className="text-sm text-destructive">{err("code")}</p>}
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
