-- Post：發文時間、已編輯、留言數／反應數、主圖改多對多、Video 關聯文章
-- 若與 Prisma migrate 產生的 join 表名不一致，請以 `prisma migrate dev` 重新產生後再部署。

-- Post 新欄位
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "published_date" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "commentCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "reactionCount" INTEGER NOT NULL DEFAULT 0;

-- 回填計數
UPDATE "Post" p SET "commentCount" = (SELECT COUNT(*)::int FROM "Comment" c WHERE c."post" = p."id");
UPDATE "Post" p SET "reactionCount" = (SELECT COUNT(*)::int FROM "Reaction" r WHERE r."post" = p."id" AND r."comment" IS NULL);

-- Video → Post
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "post" INTEGER;
CREATE INDEX IF NOT EXISTS "Video_post_idx" ON "Video"("post");
DO $$ BEGIN
  ALTER TABLE "Video" ADD CONSTRAINT "Video_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 主圖多對多（Prisma implicit：Image 與 Post，表名常為 _ImageToPost；A=Image.id, B=Post.id）
CREATE TABLE IF NOT EXISTS "_ImageToPost" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "_ImageToPost_AB_unique" ON "_ImageToPost"("A", "B");
CREATE INDEX IF NOT EXISTS "_ImageToPost_B_index" ON "_ImageToPost"("B");
DO $$ BEGIN
  ALTER TABLE "_ImageToPost" ADD CONSTRAINT "_ImageToPost_A_fkey" FOREIGN KEY ("A") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "_ImageToPost" ADD CONSTRAINT "_ImageToPost_B_fkey" FOREIGN KEY ("B") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 舊單一主圖 → join 表（A=Image, B=Post）
INSERT INTO "_ImageToPost" ("A", "B")
SELECT p."heroImage", p."id" FROM "Post" p
WHERE p."heroImage" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "_ImageToPost" x WHERE x."A" = p."heroImage" AND x."B" = p."id"
  );

-- 移除舊欄位
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_heroImage_fkey";
DROP INDEX IF EXISTS "Post_heroImage_idx";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "heroImage";
