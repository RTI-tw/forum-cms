-- Prisma enum 預設對應 PostgreSQL 型別名 TopicStateType / EditorChoiceStateType；
-- 舊 migration 建立的是 TopicState / EditorChoiceState。更名後與 Prisma 一致，無需依賴 prisma generate 是否帶入 @@map。

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'TopicState'
  ) THEN
    ALTER TYPE "TopicState" RENAME TO "TopicStateType";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'EditorChoiceState'
  ) THEN
    ALTER TYPE "EditorChoiceState" RENAME TO "EditorChoiceStateType";
  END IF;
END $$;
