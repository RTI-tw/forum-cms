-- Event: boost flag for frontend/API prioritization.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isBoost" BOOLEAN NOT NULL DEFAULT false;
