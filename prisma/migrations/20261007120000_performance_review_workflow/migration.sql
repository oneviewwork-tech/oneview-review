-- CreateEnum
CREATE TYPE "PerfReviewStatus" AS ENUM ('SUBMITTED', 'NEEDS_REVISION', 'CONFIRMED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PERF_REVIEW_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'PERF_REVIEW_REVISION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PERF_REVIEW_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'PERF_REMINDER_SENT';

-- CreateTable
CREATE TABLE "PerfReview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "status" "PerfReviewStatus" NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "reviewerUserId" TEXT,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "revisionNote" TEXT,
    "revisionRequestedAt" TIMESTAMP(3),
    "finalScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "weeksScored" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerfReview_status_period_idx" ON "PerfReview"("status", "period");

-- CreateIndex
CREATE INDEX "PerfReview_reviewerUserId_status_idx" ON "PerfReview"("reviewerUserId", "status");

-- CreateIndex
CREATE INDEX "PerfReview_submittedById_idx" ON "PerfReview"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "PerfReview_employeeId_period_key" ON "PerfReview"("employeeId", "period");

-- AddForeignKey
ALTER TABLE "PerfReview" ADD CONSTRAINT "PerfReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfReview" ADD CONSTRAINT "PerfReview_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfReview" ADD CONSTRAINT "PerfReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfReview" ADD CONSTRAINT "PerfReview_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

