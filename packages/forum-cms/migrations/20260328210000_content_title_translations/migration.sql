-- AlterTable: 靜態頁 Content 標題與多語標題（與 Post 欄位對齊，供 message-services 翻譯）
ALTER TABLE "Content" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Content" ADD COLUMN "title_zh" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Content" ADD COLUMN "title_en" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Content" ADD COLUMN "title_vi" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Content" ADD COLUMN "title_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Content" ADD COLUMN "title_th" TEXT NOT NULL DEFAULT '';
