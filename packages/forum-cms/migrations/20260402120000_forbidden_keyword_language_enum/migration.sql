-- ForbiddenKeyword.language：由 TopicLanguageType 改為專用 enum，與 Keystone / Prisma 預設一致（免 extendPrismaSchema）
CREATE TYPE "ForbiddenKeywordLanguageType" AS ENUM ('zh', 'en', 'vi', 'id', 'th');

ALTER TABLE "ForbiddenKeyword"
  ALTER COLUMN "language" TYPE "ForbiddenKeywordLanguageType"
  USING ("language"::text::"ForbiddenKeywordLanguageType");
