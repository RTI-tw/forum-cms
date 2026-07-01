-- Backfill Poll.voterCount for existing polls (distinct voters). Newly added
-- migration column defaults to 0 and is only recomputed when a vote changes, so
-- without this backfill existing polls would rank/display as 0 voters until the
-- next vote. syncPollVoteAggregates keeps it in sync from here on.
UPDATE "Poll" AS p
SET "voterCount" = (
  SELECT COUNT(DISTINCT pv."member")
  FROM "PollVote" AS pv
  WHERE pv."poll" = p."id" AND pv."member" IS NOT NULL
);
