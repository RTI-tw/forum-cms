-- Add password policy fields and migrate legacy data
ALTER TABLE "User"
  ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "User"
SET "passwordUpdatedAt" = COALESCE("passwordUpdatedAt", CURRENT_TIMESTAMP);

UPDATE "User"
SET "mustChangePassword" = COALESCE("needChangePassword", FALSE);

ALTER TABLE "User"
  ALTER COLUMN "passwordUpdatedAt" SET NOT NULL;

ALTER TABLE "User"
  DROP COLUMN "needChangePassword";

