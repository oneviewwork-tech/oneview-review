"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { renderEmail, type TemplateOverride } from "@/domain/email/render";
import { saveEmailTemplate, resetEmailTemplate } from "@/actions/email-template.actions";

type Type = "A" | "B" | "C";

export interface TemplateState {
  type: Type;
  label: string;
  current: TemplateOverride;
  builtIn: TemplateOverride;
  customized: boolean;
  /** "Edited by Saniya, 17 Nov 2026" */
  editedNote: string | null;
}

const VARIABLES = [
  { key: "{{employee_name}}", hint: "Employee's name" },
  { key: "{{month_name}}", hint: "Review month" },
  { key: "{{year}}", hint: "Review year" },
  { key: "{{feedback}}", hint: "The written feedback (required)" },
];

const SAMPLE = {
  employee_name: "Rahul Kumar",
  month_name: "October",
  year: "2026",
  feedback: "Rahul has consistently delivered assigned development work on time and shown strong ownership.\nHe should keep improving documentation and communication.",
};

/**
 * Edit the A/B/C feedback emails: subject and body on the left, the email as
 * it will arrive on the right (rendered by the same function that sends it).
 */
export function TemplateEditor({ templates }: { templates: TemplateState[] }) {
  const [active, setActive] = useState<Type>(templates[0].type);
  const [drafts, setDrafts] = useState<Record<Type, TemplateOverride>>(
    () => Object.fromEntries(templates.map((t) => [t.type, t.current])) as Record<Type, TemplateOverride>
  );
  const [pending, start] = useTransition();
  const { push } = useToast();
  const router = useRouter();

  const t = templates.find((x) => x.type === active)!;
  const draft = drafts[active];
  const dirty = draft.subject !== t.current.subject || draft.body !== t.current.body;
  const preview = useMemo(() => renderEmail(active, SAMPLE, draft), [active, draft]);
  const set = (patch: Partial<TemplateOverride>) => setDrafts((d) => ({ ...d, [active]: { ...d[active], ...patch } }));

  const save = () =>
    start(async () => {
      const r = await saveEmailTemplate({ type: active, ...draft });
      push(r.success ? "success" : "error", r.message ?? (r.success ? "Saved." : "Something went wrong."));
      if (r.success) router.refresh();
    });
  const reset = () =>
    start(async () => {
      const r = await resetEmailTemplate(active);
      push(r.success ? "success" : "error", r.message ?? "Done.");
      if (r.success) {
        setDrafts((d) => ({ ...d, [active]: t.builtIn }));
        router.refresh();
      }
    });

  return (
    <div className="space-y-5">
      {/* Template tabs */}
      <div className="flex flex-wrap gap-2">
        {templates.map((x) => {
          const changed = drafts[x.type].subject !== x.current.subject || drafts[x.type].body !== x.current.body;
          return (
            <button
              key={x.type}
              type="button"
              onClick={() => setActive(x.type)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-ui",
                active === x.type ? "bg-ink text-ink-foreground shadow-sm" : "bg-card text-muted-foreground shadow-xs hover:text-foreground"
              )}
            >
              {x.label}
              {x.customized && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", active === x.type ? "bg-white/20" : "bg-brand-subtle text-brand")}>Edited</span>}
              {changed && <span aria-label="Unsaved changes" className="size-2 rounded-full bg-chart-pink" />}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4 rounded-[1.5rem] bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.editedNote ?? "Default wording"}</p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Subject</span>
            <input
              value={draft.subject}
              onChange={(e) => set({ subject: e.target.value })}
              maxLength={300}
              className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Body</span>
            <span className="block text-xs text-muted-foreground">Leave a blank line between paragraphs.</span>
            <textarea
              value={draft.body}
              onChange={(e) => set({ body: e.target.value })}
              rows={18}
              className="w-full rounded-xl border border-input bg-card px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filled in automatically</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={`${v.hint}. Click to copy.`}
                  onClick={() => navigator.clipboard?.writeText(v.key).then(() => push("success", `Copied ${v.key}`))}
                  className="rounded-full bg-brand-subtle px-2.5 py-1 font-mono text-[12px] text-brand transition-ui hover:bg-brand hover:text-white"
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            {t.customized && (
              <Button type="button" variant="outline" onClick={reset} disabled={pending}>
                <RotateCcw className="size-4" /> Reset to default
              </Button>
            )}
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => set(t.current)} disabled={pending}>
                Discard changes
              </Button>
            )}
            <Button type="button" onClick={save} loading={pending} disabled={!dirty}>
              <Save className="size-4" /> Save {t.label}
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-[1.5rem] bg-card p-5 shadow-sm sm:p-6 xl:sticky xl:top-20 xl:self-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview · sample employee</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Subject: <span className="font-semibold text-foreground">{preview.subject}</span>
          </p>
          <div
            className="mt-4 rounded-xl border border-border bg-background/50 p-4 text-sm leading-relaxed [&_p+p]:mt-3"
            // Built by renderEmail, which escapes every filled-in value.
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </div>
      </div>
    </div>
  );
}
