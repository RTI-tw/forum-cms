ALTER TYPE "CommentStatusType" ADD VALUE IF NOT EXISTS 'reject';

UPDATE "Comment"
SET "status" = 'hidden'
WHERE "status"::text = 'deleted'
  AND (
    "member" IS NULL
    OR "member" IN (
      SELECT m."id"
      FROM "Member" m
      WHERE COALESCE(m."isOfficial", false) = false
    )
  );

UPDATE "Comment"
SET "status" = 'reject'
WHERE "status"::text = 'deleted';

CREATE TYPE "CommentStatusType_new" AS ENUM ('published', 'archived', 'hidden', 'reject');

ALTER TABLE "Comment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Comment"
  ALTER COLUMN "status" TYPE "CommentStatusType_new"
  USING ("status"::text::"CommentStatusType_new");

ALTER TYPE "CommentStatusType" RENAME TO "CommentStatusType_old";
ALTER TYPE "CommentStatusType_new" RENAME TO "CommentStatusType";
DROP TYPE "CommentStatusType_old";

ALTER TABLE "Comment" ALTER COLUMN "status" SET DEFAULT 'published';
