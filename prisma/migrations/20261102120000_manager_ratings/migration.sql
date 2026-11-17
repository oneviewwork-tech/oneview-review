-- Employees rate their manager and head (1–5 stars) once a month is
-- confirmed. Only HR and Admin see these. Additive only.

-- CreateEnum
CREATE TYPE "RatedAs" AS ENUM ('SCORER', 'REVIEWER');

-- CreateTable
CREATE TABLE "ManagerRating" (
    "id" TEXT NOT NULL,
    "raterEmployeeId" TEXT NOT NULL,
    "period" DATE NOT NULL,
    "ratedAs" "RatedAs" NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerRating_targetUserId_period_idx" ON "ManagerRating"("targetUserId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerRating_raterEmployeeId_period_ratedAs_key" ON "ManagerRating"("raterEmployeeId", "period", "ratedAs");

-- AddForeignKey
ALTER TABLE "ManagerRating" ADD CONSTRAINT "ManagerRating_raterEmployeeId_fkey" FOREIGN KEY ("raterEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerRating" ADD CONSTRAINT "ManagerRating_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
