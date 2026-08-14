import { z } from "zod";

export const createSubmissionSchema = z.object({
  employeeId: z.string().min(1, "Select an employee."),
  templateType: z.enum(["A", "B", "C"], { message: "Select a template." }),
  feedback: z
    .string()
    .trim()
    .min(20, "Feedback must be at least 20 characters.")
    .max(4000, "Feedback is too long."),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
