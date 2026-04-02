-- 移除留言：父留言、根留言、按讚（_Comment_like）；新增 reactionCount
DROP TABLE IF EXISTS "_Comment_like";

ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_parent_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_root_fkey";

DROP INDEX IF EXISTS "Comment_parent_idx";
DROP INDEX IF EXISTS "Comment_root_idx";

ALTER TABLE "Comment" DROP COLUMN IF EXISTS "parent";
ALTER TABLE "Comment" DROP COLUMN IF EXISTS "root";

ALTER TABLE "Comment" ADD COLUMN "reactionCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Comment" c
SET "reactionCount" = (
  SELECT COUNT(*)::int FROM "Reaction" r WHERE r."comment" = c."id"
);

CREATE INDEX "Comment_reactionCount_idx" ON "Comment"("reactionCount");
