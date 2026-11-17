import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const templateDetailsSchema = z.object({
  name: z.string().trim().min(2, "Give the template a name.").max(80),
  roleDefinition: optionalText(4000),
  responsibilities: optionalText(8000),
});

export const assignmentSchema = z.object({
  employeeId: z.string().min(1),
  templateId: z.string().min(1, "Choose a template."),
  scorerUserId: z.string().min(1, "Choose who scores this person."),
});

const kpiSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Every KPI needs a name.").max(160),
    description: optionalText(500),
    maxPoints: z.number().positive("Weights must be above 0.").max(1000),
    mode: z.enum(["RATING", "TARGET"]),
    target: z.number().positive().nullable().optional(),
    direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]).nullable().optional(),
  })
  .refine((k) => k.mode === "RATING" || (k.target != null && k.direction != null), {
    message: "A target KPI needs a target and a direction.",
    path: ["target"],
  });

export const versionSchema = z.object({
  templateId: z.string().min(1),
  versionId: z.string().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}$/, "Pick the month this takes effect."),
  kras: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Every KRA needs a name.").max(160),
        kpis: z.array(kpiSchema).min(1, "Every KRA needs at least one KPI."),
      })
    )
    .min(1, "Add at least one KRA."),
  risks: z.array(
    z.object({
      id: z.string().optional(),
      category: z.string().trim().min(1).max(160),
      name: z.string().trim().min(1).max(160),
      description: optionalText(800),
      alertLevel: optionalText(200),
    })
  ),
});

export type VersionInput = z.infer<typeof versionSchema>;
