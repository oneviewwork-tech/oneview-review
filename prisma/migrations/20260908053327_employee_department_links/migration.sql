-- CreateTable
CREATE TABLE "EmployeeDepartmentLink" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDepartmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeDepartmentLink_departmentId_idx" ON "EmployeeDepartmentLink"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDepartmentLink_employeeId_departmentId_key" ON "EmployeeDepartmentLink"("employeeId", "departmentId");

-- AddForeignKey
ALTER TABLE "EmployeeDepartmentLink" ADD CONSTRAINT "EmployeeDepartmentLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartmentLink" ADD CONSTRAINT "EmployeeDepartmentLink_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
