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

export interface ReviewEmployee {
  id: string;
  name: string;
  email: string;
}

const initialState = undefined;

export function ReviewForm({ employees }: { employees: ReviewEmployee[] }) {
  const [state, formAction, isPending] = useActionState(createSubmission, initialState);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [templateType, setTemplateType] = useState<TemplateType | "">("");
  const [feedback, setFeedback] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId]
  );

  // Reset the form after a successful submit so the next review starts
  // clean. Adjusted during render (not an effect) per React's guidance for
  // state that depends on a changing prop/value — avoids an extra render.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setTemplateType("");
      setFeedback("");
    }
  }

  if (employees.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No employees are assigned to your department yet. Contact HR to get set up.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="employeeId">Employee</Label>
        <Dropdown
          id="employeeId"
          name="employeeId"
          value={employeeId}
          onChange={setEmployeeId}
          options={employees.map((e) => ({ value: e.id, label: e.name }))}
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
        <Label htmlFor="feedback">Performance Feedback</Label>
        <Textarea
          id="feedback"
          name="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Describe this employee's performance this month…"
          required
        />
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

      <Button type="submit" loading={isPending} disabled={!templateType}>
        Submit Feedback
      </Button>
    </form>
  );
}
