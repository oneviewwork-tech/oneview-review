-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PEOPLE_SYNCED';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "peopleEmployeeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_peopleEmployeeId_key" ON "Employee"("peopleEmployeeId");
