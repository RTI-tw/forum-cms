-- 活動內容欄位改為比照文章頁：content、images、externalLink。

ALTER TABLE "Event" ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
UPDATE "Event" SET "content" = COALESCE("description", '') WHERE "content" = '';
ALTER TABLE "Event" DROP COLUMN "description";

ALTER TABLE "Event" ADD COLUMN "externalLink" TEXT NOT NULL DEFAULT '';

CREATE TABLE "_Event_images" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

CREATE UNIQUE INDEX "_Event_images_AB_unique" ON "_Event_images"("A", "B");
CREATE INDEX "_Event_images_B_index" ON "_Event_images"("B");

ALTER TABLE "_Event_images" ADD CONSTRAINT "_Event_images_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_Event_images" ADD CONSTRAINT "_Event_images_B_fkey" FOREIGN KEY ("B") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
