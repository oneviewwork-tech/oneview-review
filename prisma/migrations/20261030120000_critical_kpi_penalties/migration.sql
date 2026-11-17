-- Critical KPIs become deductions: points entered against one come off the
-- month's score. Additive only — no existing column or row is changed except
-- the backfill flagging the risks that are critical KPIs.

-- AlterTable
ALTER TABLE "PerfRisk" ADD COLUMN "deductible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxPenalty" DOUBLE PRECISION;

-- The scorecards loaded so far mark their critical KPIs with this alert level.
UPDATE "PerfRisk" SET "deductible" = true WHERE "alertLevel" LIKE 'Critical KPI%';

-- CreateTable
CREATE TABLE "PerfPenalty" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "remark" TEXT,
    "enteredById" TEXT NOT NULL,
    "enteredByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerfPenalty_employeeId_period_idx" ON "PerfPenalty"("employeeId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PerfPenalty_employeeId_riskId_period_key" ON "PerfPenalty"("employeeId", "riskId", "period");

-- AddForeignKey
ALTER TABLE "PerfPenalty" ADD CONSTRAINT "PerfPenalty_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfPenalty" ADD CONSTRAINT "PerfPenalty_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "PerfRisk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfPenalty" ADD CONSTRAINT "PerfPenalty_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
