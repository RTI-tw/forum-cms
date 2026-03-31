-- 還原 Post.isLifeGuide（先前移除 LifeGuide list 時一併刪除欄位；旗標仍保留於文章）

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isLifeGuide" BOOLEAN NOT NULL DEFAULT false;
