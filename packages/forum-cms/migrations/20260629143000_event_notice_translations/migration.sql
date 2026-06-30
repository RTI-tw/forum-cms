-- AlterTable: Event 活動須知五語翻譯欄位
ALTER TABLE "Event"
  ADD COLUMN "notice_zh" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notice_en" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notice_vi" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notice_id" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notice_th" TEXT NOT NULL DEFAULT '';
