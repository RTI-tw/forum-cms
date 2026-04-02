-- 主圖改為顯式中介表 PostHeroImage（含 sortOrder），取代 Prisma 隱式多對多表
CREATE TABLE "PostHeroImage" (
    "id" SERIAL NOT NULL,
    "post" INTEGER NOT NULL,
    "photo" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "PostHeroImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostHeroImage_postId_photoId_key" ON "PostHeroImage"("post", "photo");
CREATE INDEX "PostHeroImage_post_idx" ON "PostHeroImage"("post");
CREATE INDEX "PostHeroImage_photo_idx" ON "PostHeroImage"("photo");
CREATE INDEX "PostHeroImage_createdBy_idx" ON "PostHeroImage"("createdBy");
CREATE INDEX "PostHeroImage_updatedBy_idx" ON "PostHeroImage"("updatedBy");

ALTER TABLE "PostHeroImage" ADD CONSTRAINT "PostHeroImage_post_fkey" FOREIGN KEY ("post") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostHeroImage" ADD CONSTRAINT "PostHeroImage_photo_fkey" FOREIGN KEY ("photo") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostHeroImage" ADD CONSTRAINT "PostHeroImage_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostHeroImage" ADD CONSTRAINT "PostHeroImage_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 自舊隱式表遷移（A=Photo, B=Post）；sortOrder 依每篇文章內 id 排序
INSERT INTO "PostHeroImage" ("post", "photo", "sortOrder", "createdAt", "updatedAt")
SELECT
    "B",
    "A",
    (ROW_NUMBER() OVER (PARTITION BY "B" ORDER BY "A") - 1),
    NOW(),
    NOW()
FROM "_Photo_postsAsHeroImages";

DROP TABLE IF EXISTS "_Photo_postsAsHeroImages";
