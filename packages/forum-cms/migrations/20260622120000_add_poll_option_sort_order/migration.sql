-- Add sortOrder to PollOption so poll options keep their configured (creation)
-- order instead of the non-deterministic id/createdAt order Keystone assigns to
-- nested batch creates (front-end poll publishing). Existing rows are backfilled
-- to 0 by the column default, so they fall back to id-asc ordering as before.
ALTER TABLE "PollOption" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0;
