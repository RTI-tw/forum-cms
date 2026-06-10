CREATE TABLE "RssTopicMapping" (
    "id" SERIAL NOT NULL,
    "rssTopic" TEXT NOT NULL DEFAULT '',
    "topic" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "RssTopicMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RssTopicMapping_rssTopic_key" ON "RssTopicMapping"("rssTopic");
CREATE INDEX "RssTopicMapping_topic_idx" ON "RssTopicMapping"("topic");
CREATE INDEX "RssTopicMapping_createdBy_idx" ON "RssTopicMapping"("createdBy");
CREATE INDEX "RssTopicMapping_updatedBy_idx" ON "RssTopicMapping"("updatedBy");

ALTER TABLE "RssTopicMapping" ADD CONSTRAINT "RssTopicMapping_topic_fkey" FOREIGN KEY ("topic") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RssTopicMapping" ADD CONSTRAINT "RssTopicMapping_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RssTopicMapping" ADD CONSTRAINT "RssTopicMapping_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
