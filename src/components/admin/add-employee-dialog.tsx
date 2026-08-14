"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { createEmployee } from "@/actions/admin.actions";

export function AddEmployeeDialog({ departments }: { departments: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [state, formAction, isPending] = useActionState(createEmployee, undefined);
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
      <Button onClick={() => setOpen(true)} disabled={departments.length === 0}>
        <Plus className="h-3.5 w-3.5" />
        Add Employee
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add employee" description="They'll appear in their department head's Review dropdown immediately.">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Name</Label>
            <Input id="emp-name" name="name" placeholder="e.g. Rahul Kumar" required autoFocus />
            {state && !state.success && state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input id="emp-email" name="email" type="email" placeholder="rahul@company.com" required />
            {state && !state.success && state.fieldErrors?.email && <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Dropdown
              id="emp-dept"
              name="departmentId"
              value={departmentId}
              onChange={setDepartmentId}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
          {state && !state.success && !state.fieldErrors && <p className="text-sm text-destructive">{state.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Add
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
