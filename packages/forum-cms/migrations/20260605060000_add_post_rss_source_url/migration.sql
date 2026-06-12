ALTER TABLE "Post" ADD COLUMN "rssSourceUrl" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Post_rssSourceUrl_idx" ON "Post"("rssSourceUrl");
