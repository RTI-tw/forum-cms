-- Post.language：舊資料可能為 NULL，與 Prisma 必填 enum 衝突；回填並設預設與 NOT NULL。

UPDATE "Post"
SET "language" = 'zh'::"PostLanguageType"
WHERE "language" IS NULL;

ALTER TABLE "Post"
  ALTER COLUMN "language" SET DEFAULT 'zh'::"PostLanguageType";

ALTER TABLE "Post"
  ALTER COLUMN "language" SET NOT NULL;
