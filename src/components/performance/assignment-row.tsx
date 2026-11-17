"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { saveAssignment, removeAssignment } from "@/actions/performance.actions";

export function AssignmentRow({
  employee,
  templates,
  scorers,
  current,
}: {
  employee: { id: string; name: string; meta: string };
  templates: DropdownOption[];
  scorers: DropdownOption[];
  current: { templateId: string; scorerUserId: string } | null;
}) {
  const [state, formAction, isPending] = useActionState(saveAssignment, undefined);
  const [templateId, setTemplateId] = useState(current?.templateId ?? "");
  const [scorerUserId, setScorerUserId] = useState(current?.scorerUserId ?? "");
  const [removing, startRemove] = useTransition();
  const { push } = useToast();

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state) push(state.success ? "success" : "error", state.message ?? "Saved.");
  }

  const dirty = templateId !== (current?.templateId ?? "") || scorerUserId !== (current?.scorerUserId ?? "");

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium leading-tight">{employee.name}</p>
        <p className="text-xs text-muted-foreground">{employee.meta}</p>
      </td>
      <td className="min-w-52 px-4 py-3">
        <Dropdown value={templateId} onChange={setTemplateId} options={templates} placeholder="Choose scorecard…" />
      </td>
      <td className="min-w-52 px-4 py-3">
        <Dropdown value={scorerUserId} onChange={setScorerUserId} options={scorers} placeholder="Choose scorer…" />
      </td>
      <td className="px-4 py-3">
        <form action={formAction} className="flex items-center justify-end gap-2">
          <input type="hidden" name="employeeId" value={employee.id} />
          <input type="hidden" name="templateId" value={templateId} />
          <input type="hidden" name="scorerUserId" value={scorerUserId} />
          <Button type="submit" size="sm" disabled={isPending || !dirty || !templateId || !scorerUserId}>
            {isPending ? "Saving…" : current ? "Update" : "Assign"}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={removing}
              onClick={() =>
                startRemove(async () => {
                  const r = await removeAssignment(employee.id);
                  push(r.success ? "success" : "error", r.message ?? "Removed.");
                })
              }
            >
              Remove
            </Button>
          )}
        </form>
      </td>
    </tr>
  );
}
