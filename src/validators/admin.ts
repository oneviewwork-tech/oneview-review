import { z } from "zod";

export const createDepartmentSchema = z.object({
  organizationId: z.string().min(1, "Select an organization."),
  name: z.string().trim().min(2, "Name is required.").max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Code is required.")
    .max(20)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters/numbers/underscore only."),
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  departmentId: z.string().min(1, "Select a department."),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  // Other departments this person is also reviewable under, beyond their
  // home one above (e.g. a department head whose own performance is
  // reviewed elsewhere). Same-organization membership is enforced where
  // this is consumed, not here.
  additionalDepartmentIds: z.array(z.string()).default([]),
});

export const updateEmployeeSchema = createEmployeeSchema.extend({
  employeeId: z.string().min(1),
});

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    role: z.enum(["DEPARTMENT_HEAD", "HR", "ADMIN"], { message: "Select a role." }),
    departmentId: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
  })
  .refine((data) => data.role !== "DEPARTMENT_HEAD" || !!data.departmentId, {
    message: "Select a department for a Team Lead.",
    path: ["departmentId"],
  });

// Password is optional here — blank means "leave it as is". Only a
// non-empty value resets it (and forces a change at next login).
export const updateUserSchema = z
  .object({
    userId: z.string().min(1),
    name: z.string().trim().min(2, "Name is required.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    role: z.enum(["DEPARTMENT_HEAD", "HR", "ADMIN"], { message: "Select a role." }),
    departmentId: z.string().optional(),
    password: z.string().trim().min(8, "Password must be at least 8 characters.").optional().or(z.literal("")),
  })
  .refine((data) => data.role !== "DEPARTMENT_HEAD" || !!data.departmentId, {
    message: "Select a department for a Team Lead.",
    path: ["departmentId"],
  });
