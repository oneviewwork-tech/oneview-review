"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TemplateSelector } from "./template-selector";
import { createSubmission } from "@/actions/submission.actions";
import type { TemplateType } from "@prisma/client";
import type { ScopeOrganization } from "@/components/hr/scope-filter";

export interface ReviewEmployee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  organizationId: string;
  designation: string | null;
}

const MAX_FEEDBACK = 4000;

export function ReviewForm({
  employees,
  organizations,
}: {
  employees: ReviewEmployee[];
  /** Only populated for Admins, who choose organization then department. */
  organizations: ScopeOrganization[];
}) {
  const [state, formAction, isPending] = useActionState(createSubmission, undefined);
  const isAdmin = organizations.length > 0;

  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const departmentOptions = useMemo(
    () => organizations.find((o) => o.id === organizationId)?.departments ?? [],
    [organizations, organizationId]
  );
  const [departmentId, setDepartmentId] = useState(departmentOptions[0]?.id ?? "");

  const visibleEmployees = useMemo(
    () => (isAdmin ? employees.filter((e) => e.departmentId === departmentId) : employees),
    [isAdmin, employees, departmentId]
  );
  const [employeeId, setEmployeeId] = useState(visibleEmployees[0]?.id ?? "");
  const [templateType, setTemplateType] = useState<TemplateType | "">("");
  const [feedback, setFeedback] = useState("");

  // Keep the cascade consistent when a parent choice changes, and clear the
  // form after a successful submit. Both derive from changing values, so
  // they're adjusted during render rather than in an effect (React's own
  // guidance) — no extra render pass.
  const [lastOrg, setLastOrg] = useState(organizationId);
  if (organizationId !== lastOrg) {
    setLastOrg(organizationId);
    const first = departmentOptions[0]?.id ?? "";
    setDepartmentId(first);
    setEmployeeId(employees.find((e) => e.departmentId === first)?.id ?? "");
  }

  const [lastDept, setLastDept] = useState(departmentId);
  if (departmentId !== lastDept) {
    setLastDept(departmentId);
    setEmployeeId(visibleEmployees[0]?.id ?? "");
  }

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setTemplateType("");
      setFeedback("");
    }
  }

  const selectedEmployee = visibleEmployees.find((e) => e.id === employeeId);

  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No employees are available yet. Add employees under Administration first.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {isAdmin && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="organizationId">Organization</Label>
            <Dropdown
              id="organizationId"
              value={organizationId}
              onChange={setOrganizationId}
              options={organizations.map((o) => ({ value: o.id, label: o.name }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="departmentId">Department</Label>
            <Dropdown
              id="departmentId"
              value={departmentId}
              onChange={setDepartmentId}
              placeholder={departmentOptions.length ? "Select a department" : "No departments yet"}
              options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))}
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="employeeId">Employee</Label>
        <Dropdown
          id="employeeId"
          name="employeeId"
          value={employeeId}
          onChange={setEmployeeId}
          placeholder={visibleEmployees.length ? "Select an employee" : "No employees in this department"}
          options={visibleEmployees.map((e) => ({
            value: e.id,
            label: e.name,
            hint: e.designation ?? undefined,
          }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="employeeEmail">Email</Label>
        <Input id="employeeEmail" value={selectedEmployee?.email ?? ""} readOnly disabled className="bg-muted" />
      </div>

      <div className="space-y-1.5">
        <Label>Template</Label>
        <TemplateSelector value={templateType} onChange={setTemplateType} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="feedback">Performance Feedback</Label>
          <span className={`text-metadata ${feedback.length > MAX_FEEDBACK ? "text-destructive" : ""}`}>
            {feedback.length} / {MAX_FEEDBACK}
          </span>
        </div>
        <Textarea
          id="feedback"
          name="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Describe this employee's performance this month…"
          required
        />
        <p className="text-metadata">
          This is the only part that changes — the rest of the email comes from the template you picked.
        </p>
        {state && !state.success && state.fieldErrors?.feedback && (
          <p className="text-sm text-destructive">{state.fieldErrors.feedback[0]}</p>
        )}
      </div>

      {state && !state.success && (
        <p role="alert" className="animate-fade-up rounded-lg border border-destructive/20 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state?.success && (
        <p role="status" className="animate-fade-up flex items-center gap-2 rounded-lg border border-success/20 bg-success-subtle px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.message}
        </p>
      )}

      <Button type="submit" loading={isPending} disabled={!templateType || !employeeId}>
        Submit Feedback
      </Button>
    </form>
  );
}
