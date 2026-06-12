CREATE TYPE "EventLabelType" AS ENUM ('hot', 'more', 'past');

ALTER TABLE "Event"
  ADD COLUMN "label" "EventLabelType" NOT NULL DEFAULT 'more',
  ADD COLUMN "notice" TEXT NOT NULL DEFAULT '';
