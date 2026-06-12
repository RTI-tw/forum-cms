CREATE TYPE "RssKeywordLanguageType" AS ENUM ('zh', 'en', 'vi', 'id', 'th');

CREATE TABLE "RssKeyword" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL DEFAULT '',
    "language" "RssKeywordLanguageType" NOT NULL DEFAULT 'zh',
    "note" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "RssKeyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RssKeyword_keyword_key" ON "RssKeyword"("keyword");

CREATE INDEX "RssKeyword_createdBy_idx" ON "RssKeyword"("createdBy");

CREATE INDEX "RssKeyword_updatedBy_idx" ON "RssKeyword"("updatedBy");

ALTER TABLE "RssKeyword" ADD CONSTRAINT "RssKeyword_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RssKeyword" ADD CONSTRAINT "RssKeyword_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
