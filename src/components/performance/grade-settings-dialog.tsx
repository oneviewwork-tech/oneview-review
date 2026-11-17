"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { saveGradeSettings } from "@/actions/performance-settings.actions";
import { DEFAULT_GRADE_SETTINGS, validateSettings, type GradeSettings } from "@/domain/performance/grading";

const FIELDS: { key: keyof GradeSettings; label: string; hint: string }[] = [
  { key: "gradeA", label: "Grade A from", hint: "High Performer" },
  { key: "gradeB", label: "Grade B from", hint: "Stable Performer; below this is C, Needs Improvement" },
  { key: "healthHigh", label: "High Performing from", hint: "department average" },
  { key: "healthStable", label: "Stable from", hint: "department average" },
  { key: "healthImproving", label: "Needs Improvement from", hint: "below this is At Risk" },
];

/** HR/Admin: edit the cut-offs that decide grades and department health. */
export function GradeSettingsDialog({ settings }: { settings: GradeSettings }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<keyof GradeSettings, string>>(
    () => Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, String(v)])) as Record<keyof GradeSettings, string>
  );
  const [pending, start] = useTransition();
  const router = useRouter();
  const { push } = useToast();

  const parsed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() === "" ? NaN : Number(v)])) as unknown as GradeSettings;
  const problem = validateSettings(parsed);

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" /> Grades
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Grade and health cut-offs"
        description="Scores are percentages of each scorecard's maximum. These decide the A/B/C grade of a person and the health label of a department."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </div>
        {problem && <p className="mt-3 text-sm text-destructive">{problem}</p>}
        <div className="mt-4 flex justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setValues(Object.fromEntries(Object.entries(DEFAULT_GRADE_SETTINGS).map(([k, v]) => [k, String(v)])) as Record<keyof GradeSettings, string>)}
          >
            Reset to the sheet&apos;s values
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !!problem}
              onClick={() =>
                start(async () => {
                  const r = await saveGradeSettings(parsed);
                  push(r.success ? "success" : "error", r.message ?? "Done.");
                  if (r.success) {
                    setOpen(false);
                    router.refresh();
                  }
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
