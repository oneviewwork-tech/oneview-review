-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REVISION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'SUBMISSION_REVISED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPARTMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPARTMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYEE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'EMPLOYEE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_UPDATED';

-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE 'NEEDS_REVISION';

-- AlterTable
ALTER TABLE "FeedbackSubmission" ADD COLUMN     "revisionNote" TEXT,
ADD COLUMN     "revisionRequestedAt" TIMESTAMP(3);
