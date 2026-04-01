-- ForbiddenKeyword：五國翻譯與原文語言（與 Topic 共用 TopicLanguageType）
ALTER TABLE "ForbiddenKeyword" ADD COLUMN "language" "TopicLanguageType";
UPDATE "ForbiddenKeyword" SET "language" = 'zh' WHERE "language" IS NULL;

ALTER TABLE "ForbiddenKeyword" ADD COLUMN "word_zh" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ForbiddenKeyword" ADD COLUMN "word_en" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ForbiddenKeyword" ADD COLUMN "word_vi" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ForbiddenKeyword" ADD COLUMN "word_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ForbiddenKeyword" ADD COLUMN "word_th" TEXT NOT NULL DEFAULT '';
