-- HR's edited wording for the A/B/C feedback emails. Additive: with no row,
-- the built-in wording in src/domain/email/templates.ts is used as before.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_TEMPLATE_SAVED';

CREATE TABLE "EmailTemplate" (
    "type" "TemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("type")
);
