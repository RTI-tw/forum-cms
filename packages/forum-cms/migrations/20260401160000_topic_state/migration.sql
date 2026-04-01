-- CreateEnum
CREATE TYPE "TopicState" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "state" "TopicState" NOT NULL DEFAULT 'active';
