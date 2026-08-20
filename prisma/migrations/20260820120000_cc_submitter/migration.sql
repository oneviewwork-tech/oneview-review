-- Capture the submitter's address on each submission so the review email can
-- CC them. Backfilled from the User record they already point at; rows whose
-- submitter no longer exists stay NULL and simply get no CC.
ALTER TABLE "FeedbackSubmission" ADD COLUMN "departmentHeadEmail" TEXT;

UPDATE "FeedbackSubmission" s
SET "departmentHeadEmail" = u."email"
FROM "User" u
WHERE s."departmentHeadId" = u."id";
