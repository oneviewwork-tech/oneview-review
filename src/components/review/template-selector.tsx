"use client";

import { cn } from "@/lib/utils";
import type { TemplateType } from "@prisma/client";

const OPTIONS: { value: TemplateType; label: string; hint: string }[] = [
  { value: "A", label: "A", hint: "Strong performance" },
  { value: "B", label: "B", hint: "Development focus" },
  { value: "C", label: "C", hint: "Improvement plan" },
];

export function TemplateSelector({
  value,
  onChange,
  name = "templateType",
}: {
  value: TemplateType | "";
  onChange: (value: TemplateType) => void;
  name?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Email template">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "relative flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-3 py-3.5 text-center transition-ui hover:-translate-y-0.5",
              selected ? "border-transparent bg-gradient-brand-soft shadow-glow" : "border-input hover:border-brand/30 hover:bg-accent"
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span className={cn("text-lg font-semibold transition-ui", selected ? "gradient-text" : "text-foreground")}>
              {opt.label}
            </span>
            <span className="text-metadata">{opt.hint}</span>
          </label>
        );
      })}
    </div>
  );
}
