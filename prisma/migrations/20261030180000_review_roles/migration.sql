-- Roles become rows with a set of permissions (and an optional organization
-- pin), so HR can have custom roles like "HR · HACA". Additive: the old
-- User.role column stays and keeps deciding which screens a person sees.

-- CreateEnum
CREATE TYPE "ReviewPermission" AS ENUM ('PERF_VIEW_ALL', 'PERF_SCORE_ANY', 'PERF_DECIDE_ANY', 'PERF_SETUP', 'PERF_GRADE_SETTINGS', 'PERF_SEND_REMINDERS', 'FEEDBACK_SUBMIT_ANY', 'FEEDBACK_REVIEW', 'FEEDBACK_SEND', 'EMPLOYEES_MANAGE', 'USERS_MANAGE', 'ROLES_MANAGE', 'DEPARTMENTS_MANAGE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "reviewRoleId" TEXT;

-- CreateTable
CREATE TABLE "ReviewRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseRole" "UserRole" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "permissions" "ReviewPermission"[] DEFAULT ARRAY[]::"ReviewPermission"[],
    "homeOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRole_name_key" ON "ReviewRole"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_reviewRoleId_fkey" FOREIGN KEY ("reviewRoleId") REFERENCES "ReviewRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRole" ADD CONSTRAINT "ReviewRole_homeOrganizationId_fkey" FOREIGN KEY ("homeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The four built-in roles (same as SYSTEM_ROLES in src/lib/permissions.ts).
INSERT INTO "ReviewRole" ("id", "name", "description", "baseRole", "isSystem", "isSuperAdmin", "permissions", "updatedAt") VALUES
  ('role_admin', 'Admin', 'Everything, in every organization.', 'ADMIN', true, true,
    ARRAY['PERF_VIEW_ALL','PERF_SCORE_ANY','PERF_DECIDE_ANY','PERF_SETUP','PERF_GRADE_SETTINGS','PERF_SEND_REMINDERS','FEEDBACK_SUBMIT_ANY','FEEDBACK_REVIEW','FEEDBACK_SEND','EMPLOYEES_MANAGE','USERS_MANAGE','ROLES_MANAGE','DEPARTMENTS_MANAGE']::"ReviewPermission"[], CURRENT_TIMESTAMP),
  ('role_hr', 'HR', 'Runs performance and feedback for the organization; manages employees and accounts.', 'HR', true, false,
    ARRAY['PERF_VIEW_ALL','PERF_SETUP','PERF_GRADE_SETTINGS','PERF_SEND_REMINDERS','FEEDBACK_REVIEW','FEEDBACK_SEND','EMPLOYEES_MANAGE','USERS_MANAGE']::"ReviewPermission"[], CURRENT_TIMESTAMP),
  ('role_team_lead', 'Team Lead', 'Submits monthly feedback for their own department.', 'DEPARTMENT_HEAD', true, false,
    ARRAY[]::"ReviewPermission"[], CURRENT_TIMESTAMP),
  ('role_employee', 'Employee', 'Sees their own scorecard; scores whoever they''re assigned.', 'EMPLOYEE', true, false,
    ARRAY[]::"ReviewPermission"[], CURRENT_TIMESTAMP);

-- Everyone keeps exactly what they had: attached to the built-in role for their current role.
UPDATE "User" SET "reviewRoleId" = CASE "role"
  WHEN 'ADMIN' THEN 'role_admin'
  WHEN 'HR' THEN 'role_hr'
  WHEN 'DEPARTMENT_HEAD' THEN 'role_team_lead'
  ELSE 'role_employee'
END;
