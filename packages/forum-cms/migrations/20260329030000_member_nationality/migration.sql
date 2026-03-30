-- Member：國籍（ISO 3166-1 alpha-2）

ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "nationality" VARCHAR(2);
