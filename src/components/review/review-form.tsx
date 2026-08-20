"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/shared/avatar";
import { EmailPreview } from "@/components/shared/email-preview";
import { TemplateSelector } from "./template-selector";
import { createSubmission } from "@/actions/submission.actions";
import { renderEmail } from "@/domain/email/render";
import { monthNameForPeriod, yearForPeriod, reviewPeriodForDate } from "@/domain/review/period";
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
  submitterEmail,
}: {
  employees: ReviewEmployee[];
  /** Only populated for Admins, who choose organization then department. */
  organizations: ScopeOrganization[];
  /** Shown in the preview's Cc line — the submitter is always copied. */
  submitterEmail: string;
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

  // Rendered on the client from the same pure function the server sends
  // with, so what is previewed here is what actually goes out.
  const preview = useMemo(() => {
    if (!templateType) return { subject: "", html: "" };
    const period = reviewPeriodForDate(new Date());
    return renderEmail(templateType, {
      employee_name: selectedEmployee?.name ?? "",
      month_name: monthNameForPeriod(period),
      year: String(yearForPeriod(period)),
      feedback: feedback.trim() || "…",
    });
  }, [templateType, selectedEmployee, feedback]);

  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No employees are available yet. Add employees under Administration first.
      </p>
    );
  }

  const over = feedback.length > MAX_FEEDBACK;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form action={formAction} className="space-y-5">
        {isAdmin && (
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
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
          {/* The address is confirmation, not an input — showing it as a
              disabled field invited people to try to edit it. */}
          {selectedEmployee && (
            <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2.5">
              <Avatar name={selectedEmployee.name} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium text-foreground">
                  {selectedEmployee.name}
                  {selectedEmployee.designation && (
                    <span className="font-normal text-muted-foreground"> · {selectedEmployee.designation}</span>
                  )}
                </p>
                <p className="truncate text-metadata">{selectedEmployee.email}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Template</Label>
          <TemplateSelector value={templateType} onChange={setTemplateType} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="feedback">Performance Feedback</Label>
            <span className={over ? "text-metadata text-destructive" : "text-metadata"}>
              {feedback.length} / {MAX_FEEDBACK}
            </span>
          </div>
          <Textarea
            id="feedback"
            name="feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Describe this employee's performance this month…"
            className="min-h-[180px]"
            required
          />
          <p className="text-metadata">
            This is the only part that changes — everything else comes from the template. The employee receives it and
            you are copied in.
          </p>
          {state && !state.success && state.fieldErrors?.feedback && (
            <p className="text-sm text-destructive">{state.fieldErrors.feedback[0]}</p>
          )}
        </div>

        {state && !state.success && (
          <p
            role="alert"
            className="animate-fade-up rounded-lg border border-destructive/20 bg-destructive-subtle px-3 py-2 text-sm text-destructive"
          >
            {state.message}
          </p>
        )}
        {state?.success && (
          <p
            role="status"
            className="animate-fade-up flex items-center gap-2 rounded-lg border border-success/20 bg-success-subtle px-3 py-2 text-sm text-success"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" loading={isPending} disabled={!templateType || !employeeId || over}>
          Submit Feedback
        </Button>
      </form>

      <aside className="xl:sticky xl:top-8">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <h2 className="text-eyebrow">Live preview</h2>
        </div>
        <EmailPreview
          to={selectedEmployee?.email ?? ""}
          cc={{ address: submitterEmail, note: "you" }}
          subject={preview.subject}
          html={preview.html}
          placeholder="Choose a template to see the email this will produce."
        />
        <p className="text-metadata mt-2">
          HR reviews this before anything is sent. Nothing reaches the employee until they confirm it.
        </p>
      </aside>
    </div>
  );
}
