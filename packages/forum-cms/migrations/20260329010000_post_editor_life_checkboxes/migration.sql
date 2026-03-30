-- Post：編輯精選／生活須知改為 checkbox 旗標，並與 EditorChoice／LifeGuide 子表對齊

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isEditorChoice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isLifeGuide" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Post" p SET "isEditorChoice" = EXISTS (
  SELECT 1 FROM "EditorChoice" e WHERE e."post" = p."id"
);
UPDATE "Post" p SET "isLifeGuide" = EXISTS (
  SELECT 1 FROM "LifeGuide" l WHERE l."post" = p."id"
);
