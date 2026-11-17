"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { createEmployee, updateEmployee } from "@/actions/admin.actions";
import { cn } from "@/lib/utils";
import type { ScopeOrganization } from "@/components/hr/scope-filter";

export interface EditableEmployee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  organizationId: string;
  designation: string | null;
  /** Departments this person is also reviewable under, beyond the home one above. */
  additionalDepartmentIds: string[];
}

/**
 * One dialog for both adding and correcting an employee — the fields are
 * identical, and keeping them in a single component means the two can't
 * drift apart.
 */
export function EmployeeDialog({
  organizations,
  employee,
}: {
  organizations: ScopeOrganization[];
  /** Omit to add; pass an employee to edit that employee. */
  employee?: EditableEmployee;
}) {
  const editing = !!employee;
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(editing ? updateEmployee : createEmployee, undefined);
  const router = useRouter();

  const [organizationId, setOrganizationId] = useState(employee?.organizationId ?? organizations[0]?.id ?? "");
  const departmentOptions = organizations.find((o) => o.id === organizationId)?.departments ?? [];
  const [departmentId, setDepartmentId] = useState(employee?.departmentId ?? departmentOptions[0]?.id ?? "");
  const [additionalDepartmentIds, setAdditionalDepartmentIds] = useState<string[]>(employee?.additionalDepartmentIds ?? []);

  const [lastOrg, setLastOrg] = useState(organizationId);
  if (organizationId !== lastOrg) {
    setLastOrg(organizationId);
    setDepartmentId(departmentOptions[0]?.id ?? "");
    setAdditionalDepartmentIds([]);
  }

  function toggleAdditionalDepartment(id: string) {
    setAdditionalDepartmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
          aria-label={`Edit ${employee.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button onClick={() => setOpen(true)} disabled={organizations.every((o) => o.departments.length === 0)}>
          <Plus className="h-3.5 w-3.5" />
          Add Employee
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${employee.name}` : "Add employee"}
        description={
          editing
            ? "Past submissions keep the details they were sent with; this only affects future ones."
            : "They appear in their department head's Review dropdown immediately."
        }
      >
        <form action={formAction} className="space-y-4">
          {editing && <input type="hidden" name="employeeId" value={employee.id} />}

          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Name</Label>
            <Input id="emp-name" name="name" defaultValue={employee?.name} placeholder="e.g. Rahul Kumar" required autoFocus />
            {err("name") && <p className="text-sm text-destructive">{err("name")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input id="emp-email" name="email" type="email" defaultValue={employee?.email} placeholder="name@company.com" required />
            {err("email") && <p className="text-sm text-destructive">{err("email")}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-designation">Designation</Label>
            <Input id="emp-designation" name="designation" defaultValue={employee?.designation ?? ""} placeholder="Optional, e.g. SEO Analyst" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-org">Organization</Label>
            <Dropdown
              id="emp-org"
              value={organizationId}
              onChange={setOrganizationId}
              options={organizations.map((o) => ({ value: o.id, label: o.name }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Dropdown
              id="emp-dept"
              name="departmentId"
              value={departmentId}
              onChange={(v) => {
                setDepartmentId(v);
                setAdditionalDepartmentIds((prev) => prev.filter((id) => id !== v));
              }}
              placeholder={departmentOptions.length ? "Select a department" : "No departments in this organization"}
              options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))}
            />
            {err("departmentId") && <p className="text-sm text-destructive">{err("departmentId")}</p>}
          </div>

          {departmentOptions.length > 1 && (
            <div className="space-y-1.5">
              <Label>Also reviewable in</Label>
              <p className="text-metadata">
                For a department head whose own performance is reviewed elsewhere, e.g. under Academics. Their home
                department above is unaffected.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {departmentOptions
                  .filter((d) => d.id !== departmentId)
                  .map((d) => {
                    const selected = additionalDepartmentIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-ui",
                          selected ? "border-brand bg-brand-subtle text-brand" : "border-border text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleAdditionalDepartment(d.id)}
                          className="sr-only"
                        />
                        {d.name}
                      </label>
                    );
                  })}
              </div>
              {additionalDepartmentIds.map((id) => (
                <input key={id} type="hidden" name="additionalDepartmentIds" value={id} />
              ))}
            </div>
          )}

          {state && !state.success && !state.fieldErrors && <p className="text-sm text-destructive">{state.message}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} disabled={!departmentId}>
              {editing ? "Save changes" : "Add"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
