-- CreateEnum
CREATE TYPE "EditorChoiceState" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "EditorChoice" ADD COLUMN "state" "EditorChoiceState" NOT NULL DEFAULT 'inactive';

-- 依關聯文章目前 status 回填（published → active）
UPDATE "EditorChoice" AS ec
SET "state" = CASE
  WHEN p."status" = 'published' THEN 'active'::"EditorChoiceState"
  ELSE 'inactive'::"EditorChoiceState"
END
FROM "Post" AS p
WHERE ec."post" = p."id";
