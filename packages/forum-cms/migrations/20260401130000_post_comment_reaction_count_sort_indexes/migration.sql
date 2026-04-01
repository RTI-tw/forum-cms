-- Improve ORDER BY / filter on denormalized counters (GraphQL PostOrderByInput).
CREATE INDEX IF NOT EXISTS "Post_commentCount_idx" ON "Post"("commentCount");
CREATE INDEX IF NOT EXISTS "Post_reactionCount_idx" ON "Post"("reactionCount");
