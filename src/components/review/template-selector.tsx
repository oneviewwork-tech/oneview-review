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
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Email template">
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-center transition-colors",
              selected ? "border-brand bg-brand-subtle" : "border-input hover:bg-accent"
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
            <span className={cn("text-lg font-semibold", selected ? "text-brand" : "text-foreground")}>
              {opt.label}
            </span>
            <span className="text-metadata">{opt.hint}</span>
          </label>
        );
      })}
    </div>
  );
}
