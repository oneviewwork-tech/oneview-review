"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { saveTemplateDetails } from "@/actions/performance.actions";

export interface EditableTemplate {
  id: string;
  name: string;
  roleDefinition: string | null;
  responsibilities: string | null;
}

/** One dialog for creating a scorecard and for editing its role-clarity text. */
export function TemplateDialog({ template }: { template?: EditableTemplate }) {
  const editing = !!template;
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(saveTemplateDetails, undefined);
  const router = useRouter();
  const { push } = useToast();

  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.success) {
      setOpen(false);
      push("success", state.message ?? "Saved.");
      if (!editing) router.push(`/performance/templates/${state.data.id}`);
      else router.refresh();
    }
  }

  const errors = state && !state.success ? state.fieldErrors : undefined;

  return (
    <>
      {editing ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" /> Edit details
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New scorecard
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit scorecard details" : "New scorecard"}
        description="The role definition and responsibilities are shown beside everyone scored with this scorecard."
        className="max-w-xl"
      >
        <form action={formAction} className="space-y-4">
          {template && <input type="hidden" name="id" value={template.id} />}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={template?.name ?? ""} placeholder="e.g. Mentor" required />
            {errors?.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roleDefinition">Role definition</Label>
            <Textarea id="roleDefinition" name="roleDefinition" defaultValue={template?.roleDefinition ?? ""} className="min-h-24" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responsibilities">Responsibilities</Label>
            <Textarea
              id="responsibilities"
              name="responsibilities"
              defaultValue={template?.responsibilities ?? ""}
              placeholder="One per line"
              className="min-h-32"
            />
          </div>
          {state && !state.success && !errors && <p className="text-sm text-destructive">{state.message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
