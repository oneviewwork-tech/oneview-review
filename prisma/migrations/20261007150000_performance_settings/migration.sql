-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PERF_SETTINGS_SAVED';

-- CreateTable
CREATE TABLE "PerfSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "gradeA" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "gradeB" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "healthHigh" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "healthStable" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "healthImproving" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByName" TEXT,

    CONSTRAINT "PerfSettings_pkey" PRIMARY KEY ("id")
);

