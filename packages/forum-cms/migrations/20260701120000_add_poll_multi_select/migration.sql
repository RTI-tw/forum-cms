-- Multi-select poll support on Poll:
--   maxSelections: how many options a member may pick (1 = single-select, the
--                  default; 2+ = multi-select). NOT NULL, existing rows -> 1.
--   voterCount:    distinct voters (a member picking several options in a
--                  multi-select poll still counts once). Used for the 熱門投票
--                  ranking and the multi-select result percentage base;
--                  recomputed from PollVote on the next vote change.
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "maxSelections" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "voterCount" INTEGER DEFAULT 0;
