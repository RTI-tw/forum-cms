ALTER TABLE "Comment" ADD COLUMN "_next_status" TEXT;

UPDATE "Comment"
SET "_next_status" = CASE
  WHEN "status"::text = 'deleted'
    AND (
      "member" IS NULL
      OR "member" IN (
        SELECT m."id"
        FROM "Member" m
        WHERE COALESCE(m."isOfficial", false) = false
      )
    )
    THEN 'hidden'
  WHEN "status"::text = 'deleted'
    THEN 'reject'
  ELSE "status"::text
END;

CREATE TYPE "CommentStatusType_new" AS ENUM ('published', 'archived', 'hidden', 'reject');

ALTER TABLE "Comment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Comment"
  ALTER COLUMN "status" TYPE "CommentStatusType_new"
  USING ("_next_status"::"CommentStatusType_new");

ALTER TYPE "CommentStatusType" RENAME TO "CommentStatusType_old";
ALTER TYPE "CommentStatusType_new" RENAME TO "CommentStatusType";
DROP TYPE "CommentStatusType_old";

ALTER TABLE "Comment" ALTER COLUMN "status" SET DEFAULT 'published';
ALTER TABLE "Comment" DROP COLUMN "_next_status";
