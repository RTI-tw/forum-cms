-- Poll.post: allow multiple poll records to reference the same post.
DROP INDEX IF EXISTS "Poll_post_key";

CREATE INDEX IF NOT EXISTS "Poll_post_idx" ON "Poll"("post");
