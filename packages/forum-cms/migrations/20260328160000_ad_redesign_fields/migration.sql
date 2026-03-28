-- Redesign Ad: title, schedule, status (draft/active/finished), videoUrl, linkUrl

-- Remove old columns that used AdStateType
ALTER TABLE "Ad" DROP COLUMN IF EXISTS "state";
DROP TYPE IF EXISTS "AdStateType";

ALTER TABLE "Ad" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Ad" DROP COLUMN IF EXISTS "showOnHomepage";
ALTER TABLE "Ad" DROP COLUMN IF EXISTS "showOnHomepageDeepTopic";
ALTER TABLE "Ad" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "Ad" DROP COLUMN IF EXISTS "sortOrder";

-- New enum and columns
CREATE TYPE "AdStatusType" AS ENUM ('draft', 'active', 'finished');

ALTER TABLE "Ad" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ad" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "Ad" ADD COLUMN "endAt" TIMESTAMP(3);
ALTER TABLE "Ad" ADD COLUMN "status" "AdStatusType" NOT NULL DEFAULT 'draft';
ALTER TABLE "Ad" ADD COLUMN "videoUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ad" ADD COLUMN "linkUrl" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Ad_status_idx" ON "Ad"("status");
CREATE INDEX "Ad_startAt_idx" ON "Ad"("startAt");
CREATE INDEX "Ad_endAt_idx" ON "Ad"("endAt");
