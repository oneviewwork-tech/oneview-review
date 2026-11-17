"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { saveTemplateVersion } from "@/actions/performance.actions";
import { cn } from "@/lib/utils";

export interface EditorKpi {
  id?: string;
  name: string;
  description: string;
  maxPoints: string;
  mode: "RATING" | "TARGET";
  target: string;
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
}
export interface EditorKra {
  id?: string;
  name: string;
  kpis: EditorKpi[];
}
export interface EditorRisk {
  id?: string;
  category: string;
  name: string;
  description: string;
  alertLevel: string;
}
export interface EditorVersion {
  id?: string;
  effectiveFrom: string;
  kras: EditorKra[];
  risks: EditorRisk[];
}

const blankKpi = (): EditorKpi => ({ name: "", description: "", maxPoints: "5", mode: "RATING", target: "", direction: "HIGHER_IS_BETTER" });

export function VersionEditor({ templateId, initial, hasScores }: { templateId: string; initial: EditorVersion; hasScores: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [effectiveFrom, setEffectiveFrom] = useState(initial.effectiveFrom);
  const [kras, setKras] = useState<EditorKra[]>(initial.kras);
  const [risks, setRisks] = useState<EditorRisk[]>(initial.risks);

  const total = kras.reduce((s, k) => s + k.kpis.reduce((p, x) => p + (Number(x.maxPoints) || 0), 0), 0);

  const patchKra = (i: number, patch: Partial<EditorKra>) => setKras((prev) => prev.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));
  const patchKpi = (ki: number, pi: number, patch: Partial<EditorKpi>) =>
    setKras((prev) =>
      prev.map((k, idx) => (idx === ki ? { ...k, kpis: k.kpis.map((p, j) => (j === pi ? { ...p, ...patch } : p)) } : k))
    );

  function save() {
    const payload = {
      templateId,
      versionId: initial.id,
      effectiveFrom,
      kras: kras.map((k) => ({
        id: k.id,
        name: k.name,
        kpis: k.kpis.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          maxPoints: Number(p.maxPoints),
          mode: p.mode,
          target: p.mode === "TARGET" ? Number(p.target) : null,
          direction: p.mode === "TARGET" ? p.direction : null,
        })),
      })),
      risks: risks.filter((r) => r.name.trim() || r.category.trim()),
    };
    startTransition(async () => {
      const result = await saveTemplateVersion(payload);
      push(result.success ? "success" : "error", result.message ?? "Saved.");
      if (result.success) {
        router.replace(`/performance/templates/${templateId}?version=${result.data.versionId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="effectiveFrom">Takes effect from</Label>
          <Input id="effectiveFrom" type="month" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="w-44" />
        </div>
        <div className="text-right">
          <p className="text-metadata">Total points</p>
          <p className={cn("text-metric", total !== 100 && "text-warning")}>{total}</p>
          {total !== 100 && <p className="text-xs text-muted-foreground">Sheets total 100; yours doesn&apos;t have to.</p>}
        </div>
      </Card>

      {hasScores && (
        <p className="rounded-lg border border-warning/30 bg-warning-subtle px-4 py-2.5 text-sm text-warning">
          Scores already exist against this version. Renaming is safe; changing a weight changes those past totals. To
          change KPIs from a later month, add a new version instead.
        </p>
      )}

      {kras.map((kra, ki) => (
        <Card key={kra.id ?? `new-${ki}`} className="p-4">
          <div className="flex items-center gap-3">
            <Input value={kra.name} onChange={(e) => patchKra(ki, { name: e.target.value })} placeholder="KRA name" className="font-semibold" aria-label="KRA name" />
            <Button variant="ghost" size="icon" aria-label="Remove KRA" onClick={() => setKras((prev) => prev.filter((_, i) => i !== ki))}>
              <Trash2 className="size-4" />
            </Button>
          </div>

          <ul className="mt-3 space-y-2">
            {kra.kpis.map((kpi, pi) => (
              <li key={kpi.id ?? `new-${pi}`} className="grid items-center gap-2 rounded-lg border border-border p-2.5 md:grid-cols-[minmax(0,1.6fr)_80px_130px_minmax(0,1fr)_auto]">
                <Input value={kpi.name} onChange={(e) => patchKpi(ki, pi, { name: e.target.value })} placeholder="KPI name" aria-label="KPI name" />
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={kpi.maxPoints}
                  onChange={(e) => patchKpi(ki, pi, { maxPoints: e.target.value })}
                  aria-label="Points"
                  title="Maximum points"
                />
                <Dropdown
                  value={kpi.mode}
                  onChange={(v) => patchKpi(ki, pi, { mode: v as EditorKpi["mode"] })}
                  options={[
                    { value: "RATING", label: "Rate in points" },
                    { value: "TARGET", label: "Vs a target" },
                  ]}
                />
                {kpi.mode === "TARGET" ? (
                  <div className="flex items-center gap-2">
                    <Dropdown
                      className="w-24"
                      value={kpi.direction}
                      onChange={(v) => patchKpi(ki, pi, { direction: v as EditorKpi["direction"] })}
                      options={[
                        { value: "HIGHER_IS_BETTER", label: "≥ higher" },
                        { value: "LOWER_IS_BETTER", label: "≤ lower" },
                      ]}
                    />
                    <Input type="number" step="any" min="0" value={kpi.target} onChange={(e) => patchKpi(ki, pi, { target: e.target.value })} placeholder="Target" aria-label="Target" />
                  </div>
                ) : (
                  <Input value={kpi.description} onChange={(e) => patchKpi(ki, pi, { description: e.target.value })} placeholder="What it measures (optional)" aria-label="Description" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove KPI"
                  onClick={() => patchKra(ki, { kpis: kra.kpis.filter((_, j) => j !== pi) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => patchKra(ki, { kpis: [...kra.kpis, blankKpi()] })}>
            <Plus className="size-3.5" /> Add KPI
          </Button>
        </Card>
      ))}

      <Button variant="outline" onClick={() => setKras((prev) => [...prev, { name: "", kpis: [blankKpi()] }])}>
        <Plus className="size-4" /> Add KRA
      </Button>

      <Card className="p-4">
        <p className="text-metadata">Risks to watch (KRIs): shown on a person&apos;s page, never scored</p>
        <ul className="mt-3 space-y-2">
          {risks.map((r, i) => (
            <li key={r.id ?? `new-${i}`} className="grid items-center gap-2 md:grid-cols-[1fr_1fr_1.4fr_1fr_auto]">
              <Input value={r.category} onChange={(e) => setRisks((p) => p.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} placeholder="Category" aria-label="Risk category" />
              <Input value={r.name} onChange={(e) => setRisks((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Risk" aria-label="Risk" />
              <Input value={r.description} onChange={(e) => setRisks((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="How it shows up" aria-label="Risk description" />
              <Input value={r.alertLevel} onChange={(e) => setRisks((p) => p.map((x, j) => (j === i ? { ...x, alertLevel: e.target.value } : x)))} placeholder="Alert level (optional)" aria-label="Alert level" />
              <Button variant="ghost" size="icon" aria-label="Remove risk" onClick={() => setRisks((p) => p.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setRisks((p) => [...p, { category: "", name: "", description: "", alertLevel: "" }])}>
          <Plus className="size-3.5" /> Add risk
        </Button>
      </Card>

      <div className="sticky bottom-0 -mx-1 flex justify-end rounded-xl border border-border bg-card p-3 shadow-sm">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : initial.id ? "Save changes" : "Create version"}
        </Button>
      </div>
    </div>
  );
}
