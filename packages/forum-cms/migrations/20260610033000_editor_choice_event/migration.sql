-- EditorChoice: allow a featured item to target either a Post or an Event.
ALTER TABLE "EditorChoice" ADD COLUMN IF NOT EXISTS "event" INTEGER;

CREATE INDEX IF NOT EXISTS "EditorChoice_event_idx" ON "EditorChoice"("event");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EditorChoice_event_fkey'
  ) THEN
    ALTER TABLE "EditorChoice"
      ADD CONSTRAINT "EditorChoice_event_fkey"
      FOREIGN KEY ("event") REFERENCES "Event"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
