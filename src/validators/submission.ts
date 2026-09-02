import { z } from "zod";

export const createSubmissionSchema = z.object({
  employeeId: z.string().min(1, "Select an employee."),
  // "YYYY-MM". Range and future-dating are checked in the domain, which
  // needs to know what "now" is.
  reviewPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Select a review month."),
  templateType: z.enum(["A", "B", "C"], { message: "Select a template." }),
  feedback: z
    .string()
    .trim()
    .min(20, "Feedback must be at least 20 characters.")
    .max(4000, "Feedback is too long."),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const reviseSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  templateType: z.enum(["A", "B", "C"], { message: "Select a template." }),
  feedback: z
    .string()
    .trim()
    .min(20, "Feedback must be at least 20 characters.")
    .max(4000, "Feedback is too long."),
});
