-- The email a person signs in with in ONEVIEW People, when it differs from the
-- address their review emails go to.
ALTER TABLE "Employee" ADD COLUMN "peopleEmail" TEXT;

CREATE INDEX "Employee_peopleEmail_idx" ON "Employee"("peopleEmail");
