ALTER TABLE "Member"
ADD COLUMN IF NOT EXISTS "isCompleteProfile" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Member"
SET "isCompleteProfile" = CASE
  WHEN COALESCE(BTRIM("firebaseId"), '') <> ''
    AND COALESCE(BTRIM("customId"), '') <> ''
    AND BTRIM("customId") <> BTRIM("firebaseId")
    AND COALESCE(BTRIM("name"), '') <> ''
    AND COALESCE(BTRIM("nickname"), '') <> ''
    THEN true
  ELSE false
END;
