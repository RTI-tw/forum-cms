-- Prisma 依 relation 名稱產生隱式多對多表名：_Post_topics、_Photo_postsAsHeroImages。
-- 先前手寫 migration 曾建立 _PostToTopic、_ImageToPost，與目前 schema 不一致，會導致
-- Prisma Client 查詢「表不存在」。此 migration 在表存在且目標表尚未存在時，更名並對齊索引／約束名稱。

-- _PostToTopic → _Post_topics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_PostToTopic')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_Post_topics') THEN
    ALTER TABLE "_PostToTopic" RENAME TO "_Post_topics";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = '_PostToTopic_AB_unique') THEN
    ALTER INDEX "_PostToTopic_AB_unique" RENAME TO "_Post_topics_AB_unique";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = '_PostToTopic_B_index') THEN
    ALTER INDEX "_PostToTopic_B_index" RENAME TO "_Post_topics_B_index";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_Post_topics') THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_PostToTopic_A_fkey') THEN
      ALTER TABLE "_Post_topics" RENAME CONSTRAINT "_PostToTopic_A_fkey" TO "_Post_topics_A_fkey";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_PostToTopic_B_fkey') THEN
      ALTER TABLE "_Post_topics" RENAME CONSTRAINT "_PostToTopic_B_fkey" TO "_Post_topics_B_fkey";
    END IF;
  END IF;
END $$;

-- _ImageToPost → _Photo_postsAsHeroImages（Photo model @@map("Image")，FK 仍指向 "Image"）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_ImageToPost')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_Photo_postsAsHeroImages') THEN
    ALTER TABLE "_ImageToPost" RENAME TO "_Photo_postsAsHeroImages";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = '_ImageToPost_AB_unique') THEN
    ALTER INDEX "_ImageToPost_AB_unique" RENAME TO "_Photo_postsAsHeroImages_AB_unique";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'i' AND c.relname = '_ImageToPost_B_index') THEN
    ALTER INDEX "_ImageToPost_B_index" RENAME TO "_Photo_postsAsHeroImages_B_index";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_Photo_postsAsHeroImages') THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ImageToPost_A_fkey') THEN
      ALTER TABLE "_Photo_postsAsHeroImages" RENAME CONSTRAINT "_ImageToPost_A_fkey" TO "_Photo_postsAsHeroImages_A_fkey";
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ImageToPost_B_fkey') THEN
      ALTER TABLE "_Photo_postsAsHeroImages" RENAME CONSTRAINT "_ImageToPost_B_fkey" TO "_Photo_postsAsHeroImages_B_fkey";
    END IF;
  END IF;
END $$;
