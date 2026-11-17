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

// A user is given a role (a ReviewRole row). A Team Lead-type role also needs
// the department they submit feedback for.
export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  roleId: z.string().min(1, "Select a role."),
  departmentId: z.string().optional(),
});

// No password: credentials live in ONEVIEW People, so this only sets the
// Review role and department scope.
export const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  roleId: z.string().min(1, "Select a role."),
  departmentId: z.string().optional(),
});

const PERMISSION_KEYS = [
  "PERF_VIEW_ALL",
  "PERF_SCORE_ANY",
  "PERF_DECIDE_ANY",
  "PERF_SETUP",
  "PERF_GRADE_SETTINGS",
  "PERF_SEND_REMINDERS",
  "FEEDBACK_SUBMIT_ANY",
  "FEEDBACK_REVIEW",
  "FEEDBACK_SEND",
  "EMPLOYEES_MANAGE",
  "USERS_MANAGE",
  "ROLES_MANAGE",
  "DEPARTMENTS_MANAGE",
] as const;

export const roleSchema = z.object({
  roleId: z.string().optional(),
  name: z.string().trim().min(2, "Give the role a name.").max(60),
  description: z.string().trim().max(240).optional(),
  baseRole: z.enum(["DEPARTMENT_HEAD", "HR", "ADMIN", "EMPLOYEE"], { message: "Choose what kind of account this is." }),
  permissions: z.array(z.enum(PERMISSION_KEYS)).default([]),
  homeOrganizationId: z.string().optional(),
});
