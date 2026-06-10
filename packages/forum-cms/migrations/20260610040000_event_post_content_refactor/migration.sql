-- Event: keep event-specific metadata only; move content fields to related Post.

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "post" INTEGER;

DO $$
DECLARE
  event_row RECORD;
  new_post_id INTEGER;
BEGIN
  FOR event_row IN
    SELECT
      id,
      title,
      content,
      status,
      "isBoost",
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy"
    FROM "Event"
    WHERE "post" IS NULL
  LOOP
    INSERT INTO "Post" (
      "title",
      "content",
      "language",
      "status",
      "isBoost",
      "published_date",
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy"
    )
    VALUES (
      COALESCE(event_row.title, ''),
      COALESCE(event_row.content, ''),
      'zh'::"PostLanguageType",
      (
        CASE event_row.status::text
          WHEN 'published' THEN 'published'
          WHEN 'draft' THEN 'draft'
          ELSE 'archived'
        END
      )::"PostStatusType",
      COALESCE(event_row."isBoost", false),
      COALESCE(event_row."createdAt", now()),
      event_row."createdAt",
      event_row."updatedAt",
      event_row."createdBy",
      event_row."updatedBy"
    )
    RETURNING id INTO new_post_id;

    UPDATE "Event"
    SET "post" = new_post_id
    WHERE id = event_row.id;
  END LOOP;
END $$;

INSERT INTO "_Photo_postsAsHeroImages" ("A", "B")
SELECT event_images."B", event_row."post"
FROM "_Event_images" event_images
JOIN "Event" event_row ON event_row.id = event_images."A"
WHERE event_row."post" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "EditorChoice" editor_choice
SET "post" = event_row."post"
FROM "Event" event_row
WHERE editor_choice."event" = event_row.id
  AND editor_choice."post" IS NULL
  AND event_row."post" IS NOT NULL;

UPDATE "EditorChoice" editor_choice
SET "state" = CASE
  WHEN post."status" = 'published' THEN 'active'::"EditorChoiceStateType"
  ELSE 'inactive'::"EditorChoiceStateType"
END
FROM "Post" post
WHERE editor_choice."post" = post.id;

CREATE INDEX IF NOT EXISTS "Event_post_idx" ON "Event"("post");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Event_post_fkey'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_post_fkey"
      FOREIGN KEY ("post") REFERENCES "Post"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "EditorChoice" DROP CONSTRAINT IF EXISTS "EditorChoice_event_fkey";
DROP INDEX IF EXISTS "EditorChoice_event_idx";
ALTER TABLE "EditorChoice" DROP COLUMN IF EXISTS "event";

DROP TABLE IF EXISTS "_Event_images";

ALTER TABLE "Event" DROP COLUMN IF EXISTS "title";
ALTER TABLE "Event" DROP COLUMN IF EXISTS "content";
ALTER TABLE "Event" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Event" DROP COLUMN IF EXISTS "isBoost";

DROP TYPE IF EXISTS "EventStatusType";
