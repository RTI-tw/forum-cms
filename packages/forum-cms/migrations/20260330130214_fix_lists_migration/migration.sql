-- DropIndex
DROP INDEX "Ad_endAt_idx";

-- DropIndex
DROP INDEX "Ad_startAt_idx";

-- DropIndex
DROP INDEX "Ad_status_idx";

-- DropIndex
DROP INDEX "Poll_post_idx";

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "published_date" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "commentCount" DROP NOT NULL,
ALTER COLUMN "reactionCount" DROP NOT NULL;
