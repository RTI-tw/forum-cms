-- 主圖順序改存於 Image.sortOrder，還原 Prisma 隱式多對多 _Photo_postsAsHeroImages，移除 PostHeroImage

-- 1. Image 新增顯示順序
ALTER TABLE "Image" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- 2. 自 PostHeroImage 回填（若表存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PostHeroImage'
  ) THEN
    UPDATE "Image" i
    SET "sortOrder" = phi."sortOrder"
    FROM "PostHeroImage" phi
    WHERE phi."photo" = i."id";
  END IF;
END $$;

-- 3. 重建隱式多對多（A=Photo/Image, B=Post），與 Prisma relation "Photo_postsAsHeroImages" 一致
CREATE TABLE "_Photo_postsAsHeroImages" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_Photo_postsAsHeroImages_AB_unique" ON "_Photo_postsAsHeroImages"("A", "B");
CREATE INDEX "_Photo_postsAsHeroImages_B_index" ON "_Photo_postsAsHeroImages"("B");

ALTER TABLE "_Photo_postsAsHeroImages" ADD CONSTRAINT "_Photo_postsAsHeroImages_A_fkey" FOREIGN KEY ("A") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_Photo_postsAsHeroImages" ADD CONSTRAINT "_Photo_postsAsHeroImages_B_fkey" FOREIGN KEY ("B") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4–5. 自 PostHeroImage 匯入關聯列後移除中介表（若曾套用 20260401180000 則表必存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PostHeroImage'
  ) THEN
    INSERT INTO "_Photo_postsAsHeroImages" ("A", "B")
    SELECT "photo", "post" FROM "PostHeroImage";
    DROP TABLE "PostHeroImage";
  END IF;
END $$;
