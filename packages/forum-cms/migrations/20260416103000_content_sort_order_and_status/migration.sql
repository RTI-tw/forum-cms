CREATE TYPE "ContentStatusType" AS ENUM ('draft', 'published');

ALTER TABLE "Content"
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ContentStatusType" NOT NULL DEFAULT 'published';
