-- 移除「生活須知」列表：刪除 LifeGuide 表與 Post.isLifeGuide 欄位（與 Keystone list 對齊）。

DROP TABLE IF EXISTS "LifeGuide" CASCADE;

ALTER TABLE "Post" DROP COLUMN IF EXISTS "isLifeGuide";
