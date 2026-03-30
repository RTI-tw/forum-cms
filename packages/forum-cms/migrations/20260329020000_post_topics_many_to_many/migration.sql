-- Post：主題由單一 FK（topic）改為與 Topic 多對多（_PostToTopic）。
-- A = Post.id，B = Topic.id（與 Prisma implicit many-to-many 一致）。

CREATE TABLE IF NOT EXISTS "_PostToTopic" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_PostToTopic_AB_unique" ON "_PostToTopic"("A", "B");
CREATE INDEX IF NOT EXISTS "_PostToTopic_B_index" ON "_PostToTopic"("B");

DO $$ BEGIN
  ALTER TABLE "_PostToTopic" ADD CONSTRAINT "_PostToTopic_A_fkey" FOREIGN KEY ("A") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "_PostToTopic" ADD CONSTRAINT "_PostToTopic_B_fkey" FOREIGN KEY ("B") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "_PostToTopic" ("A", "B")
SELECT p."id", p."topic" FROM "Post" p
WHERE p."topic" IS NOT NULL
ON CONFLICT ("A", "B") DO NOTHING;

ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_topic_fkey";
DROP INDEX IF EXISTS "Post_topic_idx";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "topic";
