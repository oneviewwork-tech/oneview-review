-- Introduces Organization and scopes departments, employees and submissions to one.
--
-- Written by hand rather than generated: the new columns are required, and
-- the tables already hold rows. Each is added nullable, backfilled to the
-- pre-existing entity (Haris & Co.), and only then made NOT NULL.

-- 1. Organization ------------------------------------------------------
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- The two entities the business actually runs. Fixed ids so the backfill
-- below and the importer can both rely on them.
INSERT INTO "Organization" ("id", "name", "code", "createdAt", "updatedAt") VALUES
  ('org_harisco', 'Haris & Co.', 'HARISCO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('org_haca', 'Haris & Co. Academy', 'HACA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. Department --------------------------------------------------------
ALTER TABLE "Department" ADD COLUMN "organizationId" TEXT;
UPDATE "Department" SET "organizationId" = 'org_harisco' WHERE "organizationId" IS NULL;
ALTER TABLE "Department" ALTER COLUMN "organizationId" SET NOT NULL;

DROP INDEX IF EXISTS "Department_name_key";
DROP INDEX IF EXISTS "Department_code_key";
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Employee ----------------------------------------------------------
ALTER TABLE "Employee" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "designation" TEXT;
ALTER TABLE "Employee" ADD COLUMN "reportingManagerName" TEXT;

-- Inherit the organization from the department the employee already sits in.
UPDATE "Employee" e
SET "organizationId" = d."organizationId"
FROM "Department" d
WHERE e."departmentId" = d."id" AND e."organizationId" IS NULL;
UPDATE "Employee" SET "organizationId" = 'org_harisco' WHERE "organizationId" IS NULL;
ALTER TABLE "Employee" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. FeedbackSubmission ------------------------------------------------
ALTER TABLE "FeedbackSubmission" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "FeedbackSubmission" ADD COLUMN "organizationName" TEXT;

UPDATE "FeedbackSubmission" s
SET "organizationId" = d."organizationId"
FROM "Department" d
WHERE s."departmentId" = d."id" AND s."organizationId" IS NULL;
UPDATE "FeedbackSubmission" SET "organizationId" = 'org_harisco' WHERE "organizationId" IS NULL;

UPDATE "FeedbackSubmission" s
SET "organizationName" = o."name"
FROM "Organization" o
WHERE s."organizationId" = o."id" AND s."organizationName" IS NULL;

ALTER TABLE "FeedbackSubmission" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FeedbackSubmission" ALTER COLUMN "organizationName" SET NOT NULL;

CREATE INDEX "FeedbackSubmission_organizationId_reviewPeriod_idx"
  ON "FeedbackSubmission"("organizationId", "reviewPeriod");
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
