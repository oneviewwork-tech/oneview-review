-- CreateEnum
CREATE TYPE "PerfKpiMode" AS ENUM ('RATING', 'TARGET');

-- CreateEnum
CREATE TYPE "PerfDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PERF_SCORE_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'PERF_ASSIGNMENT_SAVED';
ALTER TYPE "AuditAction" ADD VALUE 'PERF_TEMPLATE_SAVED';

-- CreateTable
CREATE TABLE "PerfTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleDefinition" TEXT,
    "responsibilities" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfKra" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PerfKra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfKpi" (
    "id" TEXT NOT NULL,
    "kraId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxPoints" DOUBLE PRECISION NOT NULL,
    "mode" "PerfKpiMode" NOT NULL DEFAULT 'RATING',
    "target" DOUBLE PRECISION,
    "direction" "PerfDirection",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PerfKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfRisk" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "alertLevel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PerfRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scorerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfScore" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "week" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "remark" TEXT,
    "enteredById" TEXT NOT NULL,
    "enteredByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfTemplate_name_key" ON "PerfTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PerfTemplateVersion_templateId_effectiveFrom_key" ON "PerfTemplateVersion"("templateId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PerfKra_versionId_idx" ON "PerfKra"("versionId");

-- CreateIndex
CREATE INDEX "PerfKpi_kraId_idx" ON "PerfKpi"("kraId");

-- CreateIndex
CREATE INDEX "PerfRisk_versionId_idx" ON "PerfRisk"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfAssignment_employeeId_key" ON "PerfAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "PerfAssignment_scorerUserId_idx" ON "PerfAssignment"("scorerUserId");

-- CreateIndex
CREATE INDEX "PerfAssignment_templateId_idx" ON "PerfAssignment"("templateId");

-- CreateIndex
CREATE INDEX "PerfScore_employeeId_period_idx" ON "PerfScore"("employeeId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PerfScore_employeeId_kpiId_period_week_key" ON "PerfScore"("employeeId", "kpiId", "period", "week");

-- AddForeignKey
ALTER TABLE "PerfTemplateVersion" ADD CONSTRAINT "PerfTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PerfTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfKra" ADD CONSTRAINT "PerfKra_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PerfTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfKpi" ADD CONSTRAINT "PerfKpi_kraId_fkey" FOREIGN KEY ("kraId") REFERENCES "PerfKra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfRisk" ADD CONSTRAINT "PerfRisk_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PerfTemplateVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfAssignment" ADD CONSTRAINT "PerfAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfAssignment" ADD CONSTRAINT "PerfAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PerfTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfAssignment" ADD CONSTRAINT "PerfAssignment_scorerUserId_fkey" FOREIGN KEY ("scorerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfScore" ADD CONSTRAINT "PerfScore_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfScore" ADD CONSTRAINT "PerfScore_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "PerfKpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfScore" ADD CONSTRAINT "PerfScore_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

